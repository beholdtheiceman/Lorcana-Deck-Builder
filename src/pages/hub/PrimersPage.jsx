import { useOutletContext } from 'react-router-dom'
import ReplayReviewPanel from '../../components/ReplayReviewPanel'

export default function PrimersPage() {
  const { hub } = useOutletContext()
  return <ReplayReviewPanel hubId={hub.id} />
}
