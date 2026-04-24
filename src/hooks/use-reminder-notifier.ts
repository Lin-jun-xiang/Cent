import dayjs from "dayjs";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { shouldNotifyReminder } from "./use-reminders";

const STORAGE_KEY = "cent-reminder-notified";

type NotifiedMap = Record<string, string>; // reminderId -> date "YYYY-MM-DD"

const loadNotified = (): NotifiedMap => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as NotifiedMap;
    } catch {
        return {};
    }
};

const saveNotified = (m: NotifiedMap) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    } catch {
        /* ignore */
    }
};

/**
 * App ???炎??reminders嚗??嗅予??銝憭拍???嚗??嗅?雿輻? targets ?改?
 * 敶?內嚗?憭拐?甈∴?瘥?reminder 銝憭拙?內銝甈∴?
 */
export function useReminderNotifier() {
    const reminders = useLedgerStore(
        useShallow((s) => s.infos?.meta.reminders ?? []),
    );
    const userId = useUserStore(useShallow((s) => s.id));
    const firedRef = useRef(false);

    useEffect(() => {
        if (!userId) return;
        if (firedRef.current) return;
        if (!reminders || reminders.length === 0) return;

        const now = dayjs();
        const todayKey = now.format("YYYY-MM-DD");
        const notified = loadNotified();
        let changed = false;

        // ?????????踹??⊿?憓
        for (const key of Object.keys(notified)) {
            if (notified[key] !== todayKey) {
                // 靽?7憭拙????
                const d = dayjs(notified[key]);
                if (!d.isValid() || now.diff(d, "day") > 7) {
                    delete notified[key];
                    changed = true;
                }
            }
        }

        const due = reminders.filter((r) =>
            shouldNotifyReminder(r, userId, now),
        );

        if (due.length > 0) {
            firedRef.current = true;
        }

        for (const r of due) {
            if (notified[r.id] === todayKey) continue;
            const when = dayjs(r.time);
            const isToday = when.isSame(now, "day");
            const prefix = isToday
                ? t("reminder-today")
                : t("reminder-tomorrow");
            const timeStr = when.format("MM/DD HH:mm");
            toast.info(`${prefix} 繚 ${timeStr}`, {
                description: r.title || r.comment,
                duration: 8000,
                position: "top-center",
            });
            notified[r.id] = todayKey;
            changed = true;
        }

        if (changed) saveNotified(notified);
    }, [reminders, userId]);
}
