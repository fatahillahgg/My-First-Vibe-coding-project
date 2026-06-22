import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { TaskDraft, TaskDraftErrors } from "./taskDraft";
import { validateTaskDraft } from "./taskDraft";

interface TaskFormProps {
  initialDraft: TaskDraft;
  submitLabel: string;
  onSubmit(draft: TaskDraft): Promise<void>;
  onCancel?: () => void;
  autoFocusTitle?: boolean;
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "The task could not be saved.";
}

export function TaskForm({ initialDraft, submitLabel, onSubmit, onCancel, autoFocusTitle = false }: TaskFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<TaskDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateTaskDraft(draft);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      titleRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(draft);
      if (!onCancel) {
        setDraft(initialDraft);
        titleRef.current?.focus();
      }
    } catch (error) {
      setSubmitError(messageFrom(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <div className="field field-wide">
        <label htmlFor={`${formId}-title`}>Task title <span aria-hidden="true">*</span></label>
        <input
          aria-label="Task title"
          aria-describedby={errors.title ? `${formId}-title-error` : undefined}
          aria-invalid={errors.title ? "true" : undefined}
          autoFocus={autoFocusTitle}
          id={`${formId}-title`}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="What needs your attention?"
          ref={titleRef}
          value={draft.title}
        />
        {errors.title && <span className="field-error" id={`${formId}-title-error`} role="alert">{errors.title}</span>}
      </div>

      <div className="field field-wide">
        <label htmlFor={`${formId}-notes`}>Notes <span>Optional</span></label>
        <textarea
          aria-label="Notes"
          id={`${formId}-notes`}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="A useful detail, link, or next step"
          rows={3}
          value={draft.notes}
        />
      </div>

      <div className="field">
        <label htmlFor={`${formId}-estimate`}>Focus estimate</label>
        <select
          aria-describedby={errors.estimatedSessions ? `${formId}-estimate-error` : undefined}
          aria-invalid={errors.estimatedSessions ? "true" : undefined}
          id={`${formId}-estimate`}
          onChange={(event) => setDraft((current) => ({ ...current, estimatedSessions: Number(event.target.value) }))}
          value={draft.estimatedSessions}
        >
          {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>{count} {count === 1 ? "session" : "sessions"}</option>
          ))}
        </select>
        {errors.estimatedSessions && <span className="field-error" id={`${formId}-estimate-error`} role="alert">{errors.estimatedSessions}</span>}
      </div>

      <div className="field">
        <label htmlFor={`${formId}-tag`}>Tag <span>Optional</span></label>
        <input
          aria-label="Tag"
          id={`${formId}-tag`}
          onChange={(event) => setDraft((current) => ({ ...current, tag: event.target.value }))}
          placeholder="e.g. Deep work"
          value={draft.tag}
        />
      </div>

      {submitError && <p className="form-error" role="alert">{submitError}</p>}

      <div className="form-actions field-wide">
        {onCancel && <button className="text-button" type="button" onClick={onCancel}>Cancel</button>}
        <button className="button button-dark" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
