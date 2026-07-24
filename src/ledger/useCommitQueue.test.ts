import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordTransactionRequest } from '../api/generated/types.gen'
import { useCommitQueue } from './useCommitQueue'

vi.mock('../api/generated/sdk.gen', () => ({ recordTransaction: vi.fn() }))
const { recordTransaction } = await import('../api/generated/sdk.gen')

const REQUEST: RecordTransactionRequest = {
  date: '2026-07-24',
  from: 'bank',
  to: 'food',
  amount: { amount: '12.00', currency: 'USD' },
}

function ok() {
  return { data: { id: 'srv-1', date: REQUEST.date, postings: [] }, response: new Response(null, { status: 201 }) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(recordTransaction).mockResolvedValue(ok() as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('the undo commit queue', () => {
  it('holds the POST until the window elapses — nothing is sent during it', async () => {
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 5000 }))

    act(() => result.current.submit(REQUEST))

    // The row exists immediately, pending, but the server has not been touched.
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].status).toBe('pending')
    expect(recordTransaction).not.toHaveBeenCalled()

    // Advance past the window; now it commits.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(recordTransaction).toHaveBeenCalledTimes(1)
    expect(recordTransaction).toHaveBeenCalledWith({ body: REQUEST })
  })

  it('cancelling within the window provably never reaches the server', async () => {
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 5000 }))

    act(() => result.current.submit(REQUEST))
    const id = result.current.entries[0].id

    act(() => result.current.cancel(id))
    expect(result.current.entries).toHaveLength(0)

    // Let any timer that might have survived fire; it must not.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(recordTransaction).not.toHaveBeenCalled()
  })

  it('reports the server transaction on commit for reconciliation', async () => {
    const onCommitted = vi.fn()
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 1000, onCommitted }))

    act(() => result.current.submit(REQUEST))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(result.current.entries[0].status).toBe('committed')
    expect(onCommitted).toHaveBeenCalledOnce()
    expect(result.current.entries[0].committed?.id).toBe('srv-1')
  })

  it('with the window off, commits immediately and shows no recall', async () => {
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 0 }))

    await act(async () => {
      result.current.submit(REQUEST)
      await Promise.resolve()
    })

    expect(recordTransaction).toHaveBeenCalledTimes(1)
    expect(result.current.entries[0].deadline).toBeUndefined()
  })

  it('marks a rejected commit as failed and keeps the request for restoration', async () => {
    vi.mocked(recordTransaction).mockResolvedValue({
      error: { title: 'Unprocessable', status: 422, code: 'SAME_ACCOUNT' },
      response: new Response(null, { status: 422 }),
    } as never)
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 500 }))

    act(() => result.current.submit(REQUEST))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(result.current.entries[0].status).toBe('failed')
    expect(result.current.entries[0].problem?.code).toBe('SAME_ACCOUNT')
    expect(result.current.entries[0].request).toEqual(REQUEST)
  })

  it('cannot cancel once committing has begun', async () => {
    const { result } = renderHook(() => useCommitQueue({ undoWindowMs: 1000 }))

    act(() => result.current.submit(REQUEST))
    const id = result.current.entries[0].id

    // Fire the timer so the entry moves to committing/committed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    act(() => result.current.cancel(id))

    // The commit still stands — cancel is a no-op past the window.
    expect(recordTransaction).toHaveBeenCalledTimes(1)
    expect(result.current.entries.find((e) => e.id === id)).toBeDefined()
  })
})
