import { create } from "zustand";

type State = {
    /**
     * 首頁目前正在檢視的日期（當天 00:00 的時間戳）
     *
     * 記帳按鈕在全域的導覽列上，本身不知道首頁停在哪一天；
     * 首頁把日期寫進這裡，新增帳單時才能預設帶入那一天，而不是一律用今天。
     * 不持久化：重開 App 應該回到今天
     */
    viewingDate?: number;
    setViewingDate: (v: number | undefined) => void;
};

export const useViewStore = create<State>((set) => ({
    viewingDate: undefined,
    setViewingDate: (viewingDate) => set({ viewingDate }),
}));

/**
 * 取得新增帳單時要用的時間戳
 *
 * 日期取自使用者正在看的那一天，時分沿用現在的時刻，
 * 這樣補記前幾天的帳時，時間排序仍然合理
 */
export const resolveNewBillTime = (viewingDate?: number) => {
    if (viewingDate === undefined) {
        return undefined;
    }
    const now = new Date();
    const target = new Date(viewingDate);
    if (target.toDateString() === now.toDateString()) {
        // 就是今天，直接用現在的時間
        return undefined;
    }
    target.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
    );
    return target.getTime();
};
