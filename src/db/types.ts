import type { ColumnType } from 'kysely';
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type account = {
    id: Generated<number>;
    username: string;
    password: string;
    registration_ip: string | null;
    registration_date: Generated<string>;
    muted_until: string | null;
    banned_until: string | null;
    staffmodlevel: Generated<number>;
    members: Generated<number>;
};
export type account_login = {
    account_id: number;
    profile: string;
    logged_in: Generated<number>;
    login_time: string | null;
    logged_out: Generated<number>;
    logout_time: string | null;
};
export type friendlist = {
    account_id: number;
    friend_account_id: number;
    profile: Generated<string>;
    created: Generated<string>;
};
export type hiscore = {
    account_id: number;
    profile: Generated<string>;
    type: number;
    level: number;
    value: number;
    date: Generated<string>;
};
export type hiscore_large = {
    account_id: number;
    profile: Generated<string>;
    type: number;
    level: number;
    value: number;
    date: Generated<string>;
};
export type ignorelist = {
    account_id: number;
    value: string;
    profile: Generated<string>;
    created: Generated<string>;
};
export type input_report = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    data: Buffer;
};
export type ipban = {
    ip: string;
};
export type private_chat = {
    id: Generated<number>;
    account_id: number;
    profile: string;
    timestamp: string;
    coord: number;
    to_account_id: number;
    message: string;
};
export type public_chat = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    coord: number;
    message: string;
};
export type report = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    coord: number;
    offender: string;
    reason: number;
};
export type session = {
    uuid: string;
    account_id: number;
    profile: string;
    world: number;
    timestamp: string;
    uid: number;
    ip: string | null;
};
export type session_log = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    coord: number;
    event: string;
    event_type: Generated<number>;
};
export type session_wealth = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    coord: number;
    event_type: Generated<number>;
    account_items: string;
    account_value: number;
    recipient_session: string | null;
    recipient_items: string | null;
    recipient_value: number | null;
};
export type DB = {
    account: account;
    account_login: account_login;
    friendlist: friendlist;
    hiscore: hiscore;
    hiscore_large: hiscore_large;
    ignorelist: ignorelist;
    input_report: input_report;
    ipban: ipban;
    private_chat: private_chat;
    public_chat: public_chat;
    report: report;
    session: session;
    session_log: session_log;
    session_wealth: session_wealth;
};
