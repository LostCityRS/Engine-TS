import InternalClient from '#/server/InternalClient.js';
import Environment from '#/util/Environment.js';

export class LoginClient extends InternalClient {
    private nodeId = 0;

    constructor(nodeId: number) {
        super(Environment.LOGIN_HOST, Environment.LOGIN_PORT);

        this.nodeId = nodeId;
    }

    public async worldStartup() {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: 'world_startup',
                nodeId: this.nodeId,
                nodeTime: Date.now(),
                profile: Environment.NODE_PROFILE
            })
        );
    }

    // custom (2026-11-02) - `token` is a saved login proving itself instead of a password,
    // `remember` is a password login asking for one to keep, and `sendsToken` is whether the
    // client is new enough to carry either - which is only ever used to say so in the log.
    public async playerLogin(username: string, password: string, uid: number, socket: string, remoteAddress: string, reconnecting: boolean, hasSave: boolean, remember: boolean = false, token: string = '', sendsToken: boolean = false) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return { reply: -1, account_id: -1, save: null, muted_until: null, members: false };
        }

        const reply = await this.wsr.fetchSync({
            type: 'player_login',
            nodeId: this.nodeId,
            nodeTime: Date.now(),
            nodeMembers: Environment.NODE_MEMBERS,
            profile: Environment.NODE_PROFILE,

            socket,
            remoteAddress,
            uid,
            username,
            password,
            reconnecting,
            hasSave,
            remember,
            token,
            sendsToken
        });

        if (reply.error) {
            return { reply: -1, account_id: -1, save: null, muted_until: null, members: false };
        }

        const { response, account_id, staffmodlevel, veteran, helper, save, muted_until, members, messageCount, remaining, token: issued } = reply.result;
        return {
            reply: response,
            account_id,
            token: issued,
            staffmodlevel,
            veteran,
            helper,
            save: save ? Buffer.from(save, 'base64') : null,
            muted_until,
            members,
            messageCount,
            remaining
        };
    }

    // returns true if the login server acknowledged the logout
    //
    // requestedAt is when the player LEFT, not when this call is made - World retries a logout
    // every 15 seconds until it is acknowledged, so the two can be minutes apart and the player
    // can be back on in between.
    public async playerLogout(username: string, save: Uint8Array, requestedAt?: number) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return false;
        }

        const reply = await this.wsr.fetchSync({
            type: 'player_logout',
            nodeId: this.nodeId,
            nodeTime: Date.now(),
            profile: Environment.NODE_PROFILE,
            username,
            save: Buffer.from(save).toString('base64'),
            requestedAt: requestedAt ?? Date.now()
        });

        if (reply.error) {
            return false;
        }

        return reply.result.response === 0;
    }

    // we don't care about acknowledgement, send the save and continue on
    public async playerAutosave(username: string, save: Uint8Array) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: 'player_autosave',
                nodeId: this.nodeId,
                nodeTime: Date.now(),
                profile: Environment.NODE_PROFILE,
                username,
                save: Buffer.from(save).toString('base64')
            })
        );
    }

    // in case the player is stuck logged-in
    public async playerForceLogout(username: string) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: 'player_force_logout',
                nodeId: this.nodeId,
                nodeTime: Date.now(),
                profile: Environment.NODE_PROFILE,
                username
            })
        );
    }

    public async playerBan(staff: string, username: string, until: Date) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: 'player_ban',
                nodeId: this.nodeId,
                nodeTime: Date.now(),
                staff,
                username,
                until
            })
        );
    }

    public async playerMute(staff: string, username: string, until: Date) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: 'player_mute',
                nodeId: this.nodeId,
                nodeTime: Date.now(),
                staff,
                username,
                until
            })
        );
    }
}
