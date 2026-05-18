"use client";

type CreateTaskStepperProps = {
  currentStep: number;
  labels?: string[];
  totalSteps: number;
};

const defaultStepLabels = [
  "Thông tin cơ bản",
  "Cài đặt công việc",
  "Xác nhận và thanh toán",
];

export function CreateTaskStepper({
  currentStep,
  labels = defaultStepLabels,
  totalSteps,
}: CreateTaskStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between overflow-x-auto pb-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={stepNumber} className="flex min-w-[110px] flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center text-center">
                <div
                  className={`flex size-8 items-center justify-center rounded-full border font-bold transition-colors ${
                    isCompleted
                      ? "border-[#22ab59] bg-[#22ab59] text-white"
                      : isActive
                        ? "border-[#22ab59] bg-white text-[#22ab59]"
                        : "border-[#d3dae6] bg-white text-[#d3dae6]"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`mt-2 max-w-24 text-xs font-medium leading-snug ${
                    isActive || isCompleted ? "text-[#01a149]" : "text-[#d3dae6]"
                  }`}
                >
                  {labels[index] ?? `Bước ${stepNumber}`}
                </span>
              </div>

              {stepNumber < totalSteps && (
                <div
                  className={`mx-2 mt-4 h-px flex-1 transition-colors ${
                    isCompleted ? "bg-[#22ab59]" : "bg-[#d3dae6]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
