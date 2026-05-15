import {
  FullSlotErrorState,
  DuplicateClaimErrorState,
  DuplicateSubmissionErrorState,
  TaskNotActiveErrorState,
  TaskExpiredErrorState,
  NoClaimErrorState,
  InvalidClaimStatusErrorState,
  ErrorState,
} from "@/components/tasks/error-states";

export default function ErrorStatesDemoPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Error States Demo</h1>
        <p className="text-slate-600">
          Trang này demo tất cả các error states đã implement cho task T064.
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Full Slot Error</h2>
          <FullSlotErrorState />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. Duplicate Claim Errors</h2>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: CLAIMED</h3>
            <DuplicateClaimErrorState status="CLAIMED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: SUBMITTED</h3>
            <DuplicateClaimErrorState status="SUBMITTED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: CANCELLED</h3>
            <DuplicateClaimErrorState status="CANCELLED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: Default</h3>
            <DuplicateClaimErrorState />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Duplicate Submission Errors</h2>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: PENDING</h3>
            <DuplicateSubmissionErrorState submissionStatus="PENDING" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: APPROVED</h3>
            <DuplicateSubmissionErrorState submissionStatus="APPROVED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: Default</h3>
            <DuplicateSubmissionErrorState />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Task Not Active Errors</h2>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: PAUSED</h3>
            <TaskNotActiveErrorState taskStatus="PAUSED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: COMPLETED</h3>
            <TaskNotActiveErrorState taskStatus="COMPLETED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: CANCELLED</h3>
            <TaskNotActiveErrorState taskStatus="CANCELLED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: DRAFT</h3>
            <TaskNotActiveErrorState taskStatus="DRAFT" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Task Expired Error</h2>
          <TaskExpiredErrorState />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. No Claim Error</h2>
          <NoClaimErrorState />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">7. Invalid Claim Status Errors</h2>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: CANCELLED</h3>
            <InvalidClaimStatusErrorState claimStatus="CANCELLED" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Status: EXPIRED</h3>
            <InvalidClaimStatusErrorState claimStatus="EXPIRED" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">8. Base Error State Variants</h2>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Variant: Info</h3>
            <ErrorState
              variant="info"
              title="Thông tin"
              description="Đây là một thông báo thông tin với variant info."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Variant: Warning</h3>
            <ErrorState
              variant="warning"
              title="Cảnh báo"
              description="Đây là một thông báo cảnh báo với variant warning."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Variant: Error</h3>
            <ErrorState
              variant="error"
              title="Lỗi"
              description="Đây là một thông báo lỗi với variant error."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Variant: Success</h3>
            <ErrorState
              variant="success"
              title="Thành công"
              description="Đây là một thông báo thành công với variant success."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
