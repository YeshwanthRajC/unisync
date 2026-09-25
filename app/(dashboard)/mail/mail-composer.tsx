"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, SparklesIcon, XIcon } from "lucide-react";

import {
  createDraftAction,
  updateDraftAction,
  generateAiDraftAction,
} from "@/app/(dashboard)/mail/actions";
import { DeleteDraftButton } from "@/app/(dashboard)/mail/delete-draft-button";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_DRAFT_TOPICS,
  AI_DRAFT_TOPIC_LABELS,
  type AiDraftTopic,
} from "@/services/mail/schema";

type PatientOption = {
  id: string;
  fullName: string;
  email?: string | null;
};

type DraftDefaults = {
  id?: string;
  patientId?: string;
  patientName?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  generatedByAI?: boolean;
};

export function MailComposer({
  defaults,
  patients = [],
}: {
  defaults?: DraftDefaults;
  patients?: PatientOption[];
}) {
  const isEdit = Boolean(defaults?.id);
  const [selectedPatientId, setSelectedPatientId] = useState(
    defaults?.patientId ?? "",
  );
  const [recipient, setRecipient] = useState(defaults?.recipient ?? "");
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState(defaults?.body ?? "");
  const [generatedByAI, setGeneratedByAI] = useState(
    defaults?.generatedByAI ?? false,
  );

  // AI draft generation state
  const [aiTopic, setAiTopic] = useState<AiDraftTopic>("APPOINTMENT_REMINDER");
  const [aiNotes, setAiNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<{
    title: string;
    message: string;
    suggestion?: string;
  } | null>(null);

  const [state, formAction] = useActionState(
    isEdit ? updateDraftAction : createDraftAction,
    null,
  );

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId);
    const found = patients.find((p) => p.id === patientId);
    if (found?.email) {
      setRecipient(found.email);
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedPatientId) {
      setAiMessage("Please select a patient first.");
      return;
    }

    setIsGenerating(true);
    setAiMessage(null);

    const formData = new FormData();
    formData.append("patientId", selectedPatientId);
    formData.append("topic", aiTopic);
    formData.append("notes", aiNotes);

    try {
      const res = await generateAiDraftAction(null, formData);
      if (res.ok && res.data) {
        setSubject(res.data.subject);
        setBody(res.data.body);
        setGeneratedByAI(true);

        if (res.data.warning) {
          setValidationWarning(res.data.warning);
          setAiMessage("⚠️ Inconsistency detected in patient records (see alert).");
        } else {
          setValidationWarning(null);
          setAiMessage("Draft generated successfully using verified patient records!");
        }
      } else {
        setAiMessage("Failed to generate draft. Please fill fields manually.");
      }
    } catch {
      setAiMessage("Could not contact draft generator.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Composer Form */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isEdit ? "Edit Email Draft" : "Compose Patient Email"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-5" noValidate>
              <FormError message={formMessage} />

              {/* Ground Truth Validation Alert Banner */}
              {validationWarning ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200 shadow-sm">
                  <AlertTriangleIcon className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Record Verification Advisory: {validationWarning.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => setValidationWarning(null)}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-300 p-0.5"
                        title="Dismiss alert"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      {validationWarning.message}
                    </p>
                    {validationWarning.suggestion ? (
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mt-1">
                        💡 Suggestion: {validationWarning.suggestion}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {defaults?.id ? (
                <input type="hidden" name="id" value={defaults.id} />
              ) : null}

              <input
                type="hidden"
                name="generatedByAI"
                value={generatedByAI ? "true" : "false"}
              />

              {!isEdit && defaults?.patientId ? (
                <input
                  type="hidden"
                  name="patientId"
                  value={defaults.patientId}
                />
              ) : null}

              {/* Patient Selection */}
              {!isEdit && !defaults?.patientId ? (
                <div className="space-y-1.5">
                  <Label htmlFor="patient-select">Patient *</Label>
                  <select
                    id="patient-select"
                    name="patientId"
                    value={selectedPatientId}
                    onChange={(e) => handlePatientChange(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">-- Choose recipient patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.email ? `(${p.email})` : "(No email on file)"}
                      </option>
                    ))}
                  </select>
                  {errors?.fieldErrors?.patientId ? (
                    <p className="text-destructive text-xs">
                      {errors.fieldErrors.patientId[0]}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {defaults?.patientName ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Recipient Patient:</span>{" "}
                  <strong className="font-semibold">{defaults.patientName}</strong>
                </div>
              ) : null}

              <Field
                name="recipient"
                type="email"
                label="Recipient Email Address *"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="patient@example.com"
                errors={errors?.fieldErrors?.recipient}
                required
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subject">Subject Line *</Label>
                  {generatedByAI ? (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <SparklesIcon className="size-3 text-amber-500" />
                      AI assisted
                    </span>
                  ) : null}
                </div>
                <input
                  id="subject"
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your upcoming appointment reminder"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
                {errors?.fieldErrors?.subject ? (
                  <p className="text-destructive text-xs">
                    {errors.fieldErrors.subject[0]}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="body">Email Message Body *</Label>
                <Textarea
                  id="body"
                  name="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write message to patient..."
                  rows={8}
                  required
                />
                {errors?.fieldErrors?.body ? (
                  <p className="text-destructive text-xs">
                    {errors.fieldErrors.body[0]}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <Button variant="outline" asChild>
                  <Link href="/mail">Cancel</Link>
                </Button>

                <div className="flex items-center gap-2">
                  <SubmitButton>
                    {isEdit ? "Save Changes" : "Save as Draft"}
                  </SubmitButton>
                </div>
              </div>
            </form>

            {isEdit && defaults?.id ? (
              <div className="pt-3 border-t mt-4 flex justify-end">
                <DeleteDraftButton emailId={defaults.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant Generator Card */}
      <div className="space-y-6">
        <Card className="border-indigo-200/80 bg-indigo-50/20 dark:bg-indigo-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <SparklesIcon className="size-4 text-indigo-600 dark:text-indigo-400" />
              AI Draft Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Use Gemini to generate a polished, courteous email draft tailored to the patient and purpose.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="ai-topic" className="text-xs">Email Purpose / Topic</Label>
              <select
                id="ai-topic"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value as AiDraftTopic)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
              >
                {AI_DRAFT_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {AI_DRAFT_TOPIC_LABELS[topic]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-notes" className="text-xs">Extra Context (Optional)</Label>
              <Textarea
                id="ai-notes"
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="e.g. Appointment scheduled tomorrow at 11 AM; mention soft food diet"
                rows={3}
                className="bg-background text-xs"
              />
            </div>

            {aiMessage ? (
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {aiMessage}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="w-full gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <SparklesIcon className="size-3.5" />
              {isGenerating ? "Drafting with Gemini..." : "Generate AI Draft"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
