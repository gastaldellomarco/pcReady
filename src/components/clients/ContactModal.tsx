import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/pcready/Modal";
import { Field } from "@/components/ui/form-field";
import type { ContactInput } from "@/lib/schemas/clients";
import type { UseFormReturn } from "react-hook-form";

/**
 *
 */
export function ContactModal({
  open,
  title,
  canEdit,
  busy,
  form,
  onClose,
  onSave,
  groups,
}: {
  open: boolean;
  title: string;
  canEdit: boolean;
  busy: boolean;
  form: UseFormReturn<ContactInput>;
  onClose: () => void;
  onSave: () => void;
  groups: readonly import("@/lib/queries/clients").ContactGroup[];
}) {
  const { t } = useTranslation("clients");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={busy}>
            {t("form.cancel", "Annulla")}
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy || !canEdit} onClick={onSave}>
            <Save className="size-3" />{" "}
            {busy ? t("contacts.saving", "Salvataggio...") : t("contacts.save", "Salva referente")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("contacts.formName", "Nome e cognome *")}>
          <input className="pc-input" {...form.register("full_name")} />
          {form.formState.errors.full_name && (
            <p className="mt-1 text-sm text-destructive">
              {form.formState.errors.full_name.message}
            </p>
          )}
        </Field>
        <Field label={t("contacts.formEmail", "Email")}>
          <input className="pc-input" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </Field>
        <Field label={t("contacts.formPhone", "Telefono")}>
          <input className="pc-input" {...form.register("phone")} />
        </Field>
        <Field label={t("contacts.formRole", "Ruolo aziendale")}>
          <input className="pc-input" {...form.register("job_title")} />
        </Field>
        <Field label={t("contacts.formDepartment", "Reparto")}>
          <input className="pc-input" {...form.register("department")} />
        </Field>
        <label className="flex items-center gap-2 pt-6 text-[12px] text-text2">
          <input type="checkbox" {...form.register("is_primary")} />
          {t("contacts.formPrimary", "Referente principale")}
        </label>
        <div className="md:col-span-2">
          <Field label={t("contacts.formNotes", "Note")}>
            <textarea className="pc-input min-h-[82px]" {...form.register("notes")} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t("contacts.formPrivateNote", "Nota privata (solo tecnici)")}>
            <textarea
              className="pc-input min-h-[72px]"
              placeholder={t("contacts.formPrivateNotePlaceholder", "Note interne non visibili dal portale cliente...")}
              {...form.register("private_note")}
            />
          </Field>
        </div>
        <Field label={t("contacts.formAvailability", "Disponibilita")}>
          <select className="pc-input" {...form.register("availability_status")}>
            <option value="">{t("contacts.availabilityDefault", "Nessuna indicazione")}</option>
            <option value="available">{t("contacts.availabilityAvailable", "Disponibile")}</option>
            <option value="vacation">{t("contacts.availabilityVacation", "In ferie")}</option>
            <option value="sick_leave">{t("contacts.availabilitySick", "In malattia")}</option>
            <option value="unavailable">{t("contacts.availabilityUnavailable", "Non disponibile")}</option>
          </select>
        </Field>
        <Field label={t("contacts.formReturnDate", "Data rientro")}>
          <input className="pc-input" type="date" {...form.register("return_date")} />
        </Field>
        <Field label={t("contacts.formGroup", "Gruppo")}>
          <select className="pc-input" {...form.register("group_id")}>
            <option value="">{t("contacts.groupNone", "Nessun gruppo")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
