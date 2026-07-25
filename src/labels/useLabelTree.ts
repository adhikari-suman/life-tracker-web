import { useCallback, useEffect, useMemo, useState } from 'react'
import { createLabel, deleteLabel, listLabels, updateLabel } from '../api/generated/sdk.gen'
import type { Label } from '../api/generated/types.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { buildLabelTree, type LabelNode } from './labelTree'

// The management page's data. Unlike the entry picker's useLabels, this fetches WITH archived
// labels — unarchiving is otherwise impossible, since a retired label is omitted from the default
// list and there would be no way to find it again.
//
// Every mutation refetches rather than patching the cache. A rename touches one row, but a
// reparent moves a whole subtree and changes the `path` of every label inside it, and reproducing
// that locally would be a second implementation of the server's tree rules — the one thing this
// module should not own. A Book holds dozens of labels, so the refetch is cheap.

export type UseLabelTree = {
  roots: LabelNode[]
  loading: boolean
  /** A load failure. Mutation failures are returned by the mutation itself. */
  problem: AppProblem | null
  reload: () => Promise<void>
  create: (name: string, parentId: string | null) => Promise<AppProblem | null>
  rename: (id: string, name: string) => Promise<AppProblem | null>
  /** `null` moves the label to the root — an explicit null, which the API distinguishes from omitted. */
  move: (id: string, parentId: string | null) => Promise<AppProblem | null>
  setArchived: (id: string, archived: boolean) => Promise<AppProblem | null>
  remove: (id: string) => Promise<AppProblem | null>
}

export function useLabelTree(): UseLabelTree {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<AppProblem | null>(null)

  const reload = useCallback(async () => {
    const { data, error, response } = await listLabels({ query: { includeArchived: true } })
    if (data !== undefined) {
      setLabels(data)
      setProblem(null)
    } else {
      setProblem(toAppProblem(error, response))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const roots = useMemo(() => buildLabelTree(labels), [labels])

  const create = useCallback(
    async (name: string, parentId: string | null) => {
      const { data, error, response } = await createLabel({
        // parentId is omitted entirely for a root label rather than sent as null — CreateLabelRequest
        // sets additionalProperties: false and documents omission as the way to create a root.
        body: parentId === null ? { name: name.trim() } : { name: name.trim(), parentId },
      })
      if (data === undefined) return toAppProblem(error, response)
      await reload()
      return null
    },
    [reload],
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      // `parentId` is deliberately absent from this body. The API distinguishes OMITTED (leave the
      // parent alone) from an explicit null (move to root), so sending null here would silently
      // unparent every label anyone renamed.
      const { data, error, response } = await updateLabel({
        path: { labelId: id },
        body: { name: name.trim() },
      })
      if (data === undefined) return toAppProblem(error, response)
      await reload()
      return null
    },
    [reload],
  )

  const move = useCallback(
    async (id: string, parentId: string | null) => {
      const { data, error, response } = await updateLabel({
        path: { labelId: id },
        body: { parentId },
      })
      if (data === undefined) return toAppProblem(error, response)
      await reload()
      return null
    },
    [reload],
  )

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const { data, error, response } = await updateLabel({
        path: { labelId: id },
        body: { archived },
      })
      if (data === undefined) return toAppProblem(error, response)
      await reload()
      return null
    },
    [reload],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error, response } = await deleteLabel({ path: { labelId: id } })
      // 204, so there is no body — the status is the answer.
      if (response === undefined || !response.ok) return toAppProblem(error, response)
      await reload()
      return null
    },
    [reload],
  )

  return { roots, loading, problem, reload, create, rename, move, setArchived, remove }
}
