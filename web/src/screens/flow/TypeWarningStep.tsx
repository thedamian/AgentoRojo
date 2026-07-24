interface Props {
  workItemType: string;
  onProceed: () => void;
  onCancel: () => void;
}

/** Shown when the loaded work item's type is not in EXPECTED_WORK_ITEM_TYPES. */
export default function TypeWarningStep({ workItemType, onProceed, onCancel }: Props) {
  return (
    <section className="step">
      <h2>Unexpected work item type</h2>
      <p>This work item is a {workItemType}, not a User Story / Product Backlog Item.</p>
      <div className="actions">
        <button type="button" onClick={onProceed}>
          Proceed anyway
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
