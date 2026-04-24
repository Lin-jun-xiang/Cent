import dayjs from "dayjs";
import { useCallback } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import type { Reminder } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

/**
 * 行事曆提醒相關的 hook（CRUD）
 *
 * 提醒會存放於 GlobalMeta.reminders，以便所有協作者都可見並被提醒
 */
export function useReminders() {
    const reminders = useLedgerStore(
        useShallow((state): Reminder[] => state.infos?.meta.reminders ?? []),
    );

    const add = useCallback(
        async (r: Omit<Reminder, "id"> & { id?: string }) => {
            const creatorId = r.creatorId ?? useUserStore.getState().id;
            const id = r.id ?? v4();
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                const list = prev.reminders ? [...prev.reminders] : [];
                list.push({ ...r, id, creatorId });
                return { ...prev, reminders: list };
            });
            return id;
        },
        [],
    );

    const update = useCallback(
        async (id: string, value?: Omit<Reminder, "id">) => {
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                const list = prev.reminders ? [...prev.reminders] : [];
                if (value === undefined) {
                    return {
                        ...prev,
                        reminders: list.filter((v) => v.id !== id),
                    };
                }
                const idx = list.findIndex((v) => v.id === id);
                if (idx === -1) return prev;
                list[idx] = { id, ...value };
                return { ...prev, reminders: list };
            });
        },
        [],
    );

    const remove = useCallback(
        async (id: string) => {
            await update(id, undefined);
        },
        [update],
    );

    return { reminders, add, update, remove };
}

/**
 * 判斷某個 reminder 是否應該今日向當前用戶提醒
 * 規則：
 *  - 提醒當天或前一天
 *  - 當前用戶必須在 targets 中
 *  - 未被標記為 done
 */
export function shouldNotifyReminder(
    r: Reminder,
    userId: number | string,
    now = dayjs(),
): boolean {
    if (r.done) return false;
    if (!r.targets?.some((t) => String(t) === String(userId))) return false;
    const d = dayjs(r.time);
    const diffDays = d.startOf("day").diff(now.startOf("day"), "day");
    return diffDays === 0 || diffDays === 1;
}
