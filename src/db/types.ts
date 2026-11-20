import type { ColumnType } from 'kysely';
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;
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
    veteran: Generated<number>;
    helper: Generated<number>;
    members: Generated<number>;
    xp_rate: Generated<number>;
};
export type account_login = {
    account_id: number;
    profile: string;
    logged_in: Generated<number>;
    login_time: string | null;
    logged_out: Generated<number>;
    logout_time: string | null;
};
export type account_token = {
    id: Generated<number>;
    account_id: number;
    token_hash: string;
    created: Generated<string>;
    last_used: Generated<string>;
    expires: string;
    uid: number | null;
    created_ip: string | null;
};
export type collection_log = {
    profile: Generated<string>;
    account_id: number;
    obj: number;
    count: number;
};
export type friendlist = {
    account_id: number;
    friend_username: string;
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
export type clan_chat = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    coord: number;
    owner: string;
    channel: string;
    message: string;
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
export type session_input = {
    id: Generated<number>;
    session_uuid: string;
    timestamp: string;
    user_actions: number;
    mouse_moves: number;
    mouse_clicks: number;
    camera_moves: number;
    focus_changes: number;
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
    account_token: account_token;
    clan_chat: clan_chat;
    collection_log: collection_log;
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
    session_input: session_input;
    session_log: session_log;
    session_wealth: session_wealth;
};
