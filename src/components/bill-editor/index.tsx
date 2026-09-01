import { type NewBillDefaults, useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";
import { isCancelError } from "../confirm/state";
import EditorForm from "./form";

const confirms = createConfirmProvider(EditorForm, {
    dialogTitle: "Edit Bill",
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[600px]",
});

const [BillEditorProvider, showBillEditor] = confirms;

export { BillEditorProvider, showBillEditor };

/**
 * 開啟新增帳單
 *
 * @param defaults 預先帶入的欄位；例如首頁停在其他日期時帶入那一天，
 *                 使用者不用每次手動改日期（仍可在表單裡調整）
 */
export const goAddBill = async (defaults?: Omit<NewBillDefaults, "isNew">) => {
    try {
        const newBill = await showBillEditor(
            defaults ? { ...defaults, isNew: true } : undefined,
        );
        // 提醒模式下不會走到這裡（內部已自行保存並取消關閉）
        if (newBill) {
            await useLedgerStore.getState().addBill(newBill);
        }
    } catch (err) {
        if (!isCancelError(err)) throw err;
    }
};
