import { useLedgerStore } from "@/store/ledger";
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

export const goAddBill = async () => {
    try {
        const newBill = await showBillEditor();
        // 提醒模式下不會走到這裡（內部已自行保存並取消關閉）
        if (newBill) {
            await useLedgerStore.getState().addBill(newBill);
        }
    } catch (err) {
        if (!isCancelError(err)) throw err;
    }
};
