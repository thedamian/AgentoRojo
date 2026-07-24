import { useState } from "react";
import { EXPECTED_WORK_ITEM_TYPES } from "@agento-rojo/shared";
import type { ProjectContext, WorkItemDetails } from "@agento-rojo/shared";
import TypeWarningStep from "./flow/TypeWarningStep";
import MappingStep from "./flow/MappingStep";
import ProjectContextStep from "./flow/ProjectContextStep";
import ReadinessStep from "./flow/ReadinessStep";
import ReviewStep from "./flow/ReviewStep";
import StatusScreen from "./flow/StatusScreen";

interface Props {
  workItem: WorkItemDetails;
  onCancel: () => void;
}

type Step =
  | { name: "typeWarning" }
  | { name: "mapping" }
  | { name: "project"; repo: string }
  | { name: "readiness"; repo: string; project: ProjectContext }
  | { name: "review"; repo: string; project: ProjectContext }
  | { name: "status"; repo: string };

const EXPECTED_TYPES: readonly string[] = EXPECTED_WORK_ITEM_TYPES;

/** Drives the linear post-load flow: type check -> mapping -> project context -> readiness -> review -> status. */
export default function WorkItemFlow({ workItem, onCancel }: Props) {
  const [step, setStep] = useState<Step>(
    EXPECTED_TYPES.includes(workItem.workItemType) ? { name: "mapping" } : { name: "typeWarning" },
  );

  return (
    <div className="flow">
      {step.name === "typeWarning" && (
        <TypeWarningStep
          workItemType={workItem.workItemType}
          onProceed={() => setStep({ name: "mapping" })}
          onCancel={onCancel}
        />
      )}
      {step.name === "mapping" && (
        <MappingStep workItem={workItem} onResolved={(repo) => setStep({ name: "project", repo })} />
      )}
      {step.name === "project" && (
        <ProjectContextStep
          repo={step.repo}
          onResolved={(project) => setStep({ name: "readiness", repo: step.repo, project })}
        />
      )}
      {step.name === "readiness" && (
        <ReadinessStep
          repo={step.repo}
          onReady={() => setStep({ name: "review", repo: step.repo, project: step.project })}
        />
      )}
      {step.name === "review" && (
        <ReviewStep
          workItem={workItem}
          repo={step.repo}
          projectContext={step.project}
          onDispatched={() => setStep({ name: "status", repo: step.repo })}
        />
      )}
      {step.name === "status" && <StatusScreen workItemId={workItem.id} repo={step.repo} />}
    </div>
  );
}
