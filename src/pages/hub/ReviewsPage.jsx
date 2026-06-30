import { useOutletContext } from 'react-router-dom'
import LlmBudgetBar from '../../components/LlmBudgetBar'
import PaperReviewForm from '../../components/PaperReviewForm'
import InsightsWidget from '../../components/InsightsWidget'
import ReplayReviewPanel from '../../components/ReplayReviewPanel'

export default function ReviewsPage() {
  const { hub } = useOutletContext()
  return (
    <div>
      <LlmBudgetBar hubId={hub.id} />
      <PaperReviewForm hubId={hub.id} />
      <InsightsWidget hubId={hub.id} />
      <div className="mt-4">
        <ReplayReviewPanel hubId={hub.id} />
      </div>
    </div>
  )
}
