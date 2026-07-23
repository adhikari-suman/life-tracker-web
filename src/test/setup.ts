import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest does not unmount between tests on its own, and a left-behind tree makes the next
// test's queries ambiguous in a way that reads as a flaky test rather than a leak.
afterEach(cleanup)
