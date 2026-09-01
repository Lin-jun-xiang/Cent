import type { Modal } from "@/components/modal";
import type { Action, Full } from "@/database/stash";
import type { Bill } from "@/ledger/type";
export type ChangeListener = (args: { bookId: string }) => void;

export type UserInfo = {
    avatar_url: string;
    name: string;
    // login: string;
    id: string;
};

export type Book = { id: string; name: string };

export type SyncEndpointConfig = {
    repoPrefix: string;
    entryName: string;
    orderKeys: string[];
};

export type SyncEndpoint = {
    logout: () => Promise<any>;

    fetchAllBooks: () => Promise<Book[]>;
    createBook: (name: string) => Promise<{
        id: string;
        name: string;
    }>;
    initBook: (id: string) => Promise<any>;
    inviteForBook?: (bookId: string) => any;
    deleteBook: (bookId: string) => Promise<any>;

    batch: (
        bookId: string,
        actions: Action<Bill>[],
        overlap?: boolean,
    ) => Promise<void>;
    getMeta: (bookId: string) => Promise<any>;
    getAllItems: (bookId: string) => Promise<Full<Bill>[]>;
    onChange(listener: (args: { bookId: string }) => void): () => void;

    getIsNeedSync: () => Promise<boolean>;
    onSync: (processor: (finished: Promise<void>) => void) => () => void;
    /**
     * 触发同步。
     * 默认只上传本地改动；带 { pull: true } 时会额外从远端拉取其他人的最新数据
     */
    toSync: (options?: { pull?: boolean }) => Promise<any>;

    getUserInfo: (id?: string) => Promise<UserInfo>;
    getCollaborators: (id: string) => Promise<UserInfo[]>;

    getOnlineAsset?: (src: string, store: string) => Promise<Blob | undefined>;

    forceNeedSync?: (store: string) => void;
};

export type SyncEndpointFactory = {
    type: string;
    name: string;
    login: (ctx: { modal: Modal }) => void;
    manuallyLogin?: (ctx: { modal: Modal }) => void;
    init: (ctx: { modal: Modal }) => SyncEndpoint;
};
