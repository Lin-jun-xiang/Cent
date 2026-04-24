import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import createConfirmProvider from "@/components/confirm";
import { DatePicker } from "@/components/date-picker";
import PopupLayout from "@/layouts/popup-layout";
import { useCreators } from "@/hooks/use-creator";
import type { Reminder } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type EditReminder = Omit<Reminder, "id"> & { id?: string };

function ReminderEditForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: EditReminder;
    onCancel?: () => void;
    onConfirm?: (v: EditReminder) => void;
}) {
    const t = useIntl();
    const userId = useUserStore((s) => s.id);
    const creators = useCreators();

    const defaultTime = useMemo(() => {
        // 預設台灣時間中午 12:00（即今日中午；使用者端時區大致為 UTC+8）
        return dayjs().hour(12).minute(0).second(0).valueOf();
    }, []);    const [title, setTitle] = useState(edit?.title ?? "");
    const [comment, setComment] = useState(edit?.comment ?? "");
    const [time, setTime] = useState<number>(edit?.time ?? defaultTime);
    const [priority, setPriority] = useState<"important" | "normal">(
        edit?.priority ?? "normal",
    );

    // 預設「全部」：所有協作者 + 自己（去重）
    const allTargetIds = useMemo(() => {
        const ids: (number | string)[] = [userId];
        for (const c of creators) {
            if (!ids.some((x) => String(x) === String(c.id))) {
                ids.push(c.id);
            }
        }
        return ids;
    }, [creators, userId]);

    const [targets, setTargets] = useState<(number | string)[]>(() =>
        edit?.targets && edit.targets.length > 0 ? edit.targets : allTargetIds,
    );

    // 協作者載入/變化時，若為新增（無 edit）且使用者尚未修改 → 同步為「全部」
    const targetsTouchedRef = useRef(false);
    useEffect(() => {
        if (edit?.targets && edit.targets.length > 0) return;
        if (targetsTouchedRef.current) return;
        setTargets(allTargetIds);
    }, [allTargetIds, edit?.targets]);

    const toggleTarget = (id: number | string) => {
        targetsTouchedRef.current = true;
        setTargets((prev) => {
            if (prev.some((p) => String(p) === String(id))) {
                return prev.filter((p) => String(p) !== String(id));
            }
            return [...prev, id];
        });
    };

    const isSelected = (id: number | string) =>
        targets.some((p) => String(p) === String(id));

    const submit = () => {
        if (!title.trim()) return;        onConfirm?.({
            ...edit,
            title: title.trim(),
            comment: comment.trim() || undefined,
            time,
            targets: targets.length > 0 ? targets : [userId],
            creatorId: edit?.creatorId ?? userId,
            done: edit?.done,
            priority,
        });
    };

    // 確保 creators 包含自己（當無協作者時 creators 可能為空）
    const selfIncluded = creators.some((c) => String(c.id) === String(userId));

    return (
        <PopupLayout
            title={t("reminder-edit") ?? "編輯提醒"}
            onBack={onCancel}
            className="h-full sm:h-auto"
        >
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="reminder-title"
                        className="text-sm font-medium"
                    >
                        {t("reminder-title") ?? "提醒標題"}
                    </label>                    <Input
                        id="reminder-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                            t("reminder-title-placeholder") ??
                            "例如：美髮"
                        }
                    />
                </div>                <div className="flex flex-col gap-1.5">
                    <div className="text-sm font-medium">
                        {t("reminder-priority") ?? "重要性"}
                    </div>
                    <div className="flex gap-1.5">
                        {(
                            [
                                {
                                    key: "important",
                                    label:
                                        t("reminder-priority-important") ??
                                        "重要",
                                    icon: "icon-[mdi--alert-circle]",
                                    color: "text-rose-500",
                                    active:
                                        "bg-rose-500 text-white border-rose-500",
                                },
                                {
                                    key: "normal",
                                    label:
                                        t("reminder-priority-normal") ?? "一般",
                                    icon: "icon-[mdi--calendar-clock-outline]",
                                    color: "text-amber-500",
                                    active:
                                        "bg-amber-500 text-white border-amber-500",
                                },
                            ] as const
                        ).map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => setPriority(p.key)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded-md border transition-colors",
                                    priority === p.key
                                        ? p.active
                                        : "bg-muted text-muted-foreground border-transparent",
                                )}
                            >
                                <i
                                    className={cn(
                                        "size-4",
                                        p.icon,
                                        priority === p.key ? "" : p.color,
                                    )}
                                />
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="text-sm font-medium">
                        {t("reminder-time") ?? "提醒時間"}
                    </div>                    <div className="border rounded-md px-2 py-1.5 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {dayjs(time).format("YYYY-MM-DD HH:mm")}
                        </span>
                        <DatePicker
                            value={time}
                            fixedTime
                            onChange={(v) => setTime(v)}
                        >
                            <span className="text-xs px-3 py-1 rounded-md border hover:bg-muted transition-colors">
                                {t("edit")}
                            </span>
                        </DatePicker>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="text-sm font-medium">
                        {t("reminder-targets") ?? "提醒人"}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {!selfIncluded && (
                            <button
                                type="button"
                                onClick={() => toggleTarget(userId)}
                                className={cn(
                                    "text-xs px-3 py-1 rounded-full border transition-colors",
                                    isSelected(userId)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-muted-foreground border-transparent",
                                )}
                            >
                                {t("me") ?? "我"}
                            </button>
                        )}
                        {creators.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleTarget(c.id)}
                                className={cn(
                                    "text-xs px-3 py-1 rounded-full border transition-colors",
                                    isSelected(c.id)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-muted-foreground border-transparent",
                                )}
                            >
                                {String(c.id) === String(userId)
                                    ? (t("me") ?? "我")
                                    : c.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="reminder-comment"
                        className="text-sm font-medium"
                    >
                        {t("comment")}
                    </label>                    <Input
                        id="reminder-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={
                            t("reminder-comment-placeholder") ??
                            "跟 eva 約西門捷運站出口"
                        }
                    />
                </div>
            </div>
            <div className="px-4 py-3 flex gap-2 justify-end border-t">
                <Button variant="ghost" onClick={onCancel}>
                    {t("cancel")}
                </Button>
                <Button onClick={submit} disabled={!title.trim()}>
                    {t("confirm") ?? "確定"}
                </Button>
            </div>
        </PopupLayout>
    );
}

export const [ReminderEditProvider, showReminderEdit] = createConfirmProvider(
    ReminderEditForm,
    {
        dialogTitle: "Reminder Edit",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
