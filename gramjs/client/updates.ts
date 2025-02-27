import type {EventBuilder,EventCommon} from "../events/common";
import {Api} from "../tl";
import {helpers} from "../";
import type {TelegramClient} from "../";
import bigInt from 'big-integer';
import {UpdateConnectionState} from "../network";
import type {Raw} from "../events";

// export class UpdateMethods {
export function on(client: TelegramClient, event: any) {
    return (f: CallableFunction) => {
        client.addEventHandler(f, event);
        return f;
    }
}

export function addEventHandler(client: TelegramClient, callback: CallableFunction, event?: EventBuilder) {
    if (event == undefined) {
        // recursive imports :(
        const raw = require("../events/Raw");
        event = new raw({}) as Raw;
    }
    client._eventBuilders.push([event, callback])
}

export function removeEventHandler(client: TelegramClient, callback: CallableFunction, event: EventBuilder) {
    client._eventBuilders = client._eventBuilders.filter(function (item) {
        return item !== [event, callback]
    })
}

export function listEventHandlers(client: TelegramClient) {
    return client._eventBuilders;
}

export function catchUp() {
    // TODO
}

export function _handleUpdate(client: TelegramClient, update: Api.TypeUpdate | number): void {
    if (typeof update === 'number') {
        if ([-1, 0, 1].includes(update)) {
            client._dispatchUpdate({update: new UpdateConnectionState(update)})
            return
        }
    }

    //this.session.processEntities(update)
    client._entityCache.add(update);
    client.session.processEntities(update);

    if (update instanceof Api.Updates || update instanceof Api.UpdatesCombined) {
        // TODO deal with entities
        const entities = []
        for (const x of [...update.users, ...update.chats]) {
            entities.push(x)
        }
        for (const u of update.updates) {
            client._processUpdate(u, update.updates, entities)
        }
    } else if (update instanceof Api.UpdateShort) {
        client._processUpdate(update.update, null)
    } else {
        client._processUpdate(update, null)
    }
}

export function _processUpdate(client: TelegramClient, update: any, others: any, entities?: any) {
    update._entities = entities || {};
    const args = {
        update: update,
        others: others,
    }

    client._dispatchUpdate(args)
}

export async function _dispatchUpdate(client: TelegramClient, args: { update: UpdateConnectionState | any }): Promise<void> {
    for (const [builder, callback] of client._eventBuilders) {
        if (!builder.resolved){
            await builder.resolve(client);
        }
        let event = args.update;
        if (event) {
            if (!client._selfInputPeer) {
                await client.getMe(true)
            }
            if (!(event instanceof UpdateConnectionState)) {
                // TODO fix me
            }
            event = builder.build(event);
            if (event) {
                if ("_eventName" in event) {
                    event._setClient(client);
                    event.originalUpdate = args.update;
                    event._entities = args.update._entities
                }
                const filter = await builder.filter(event);
                if (!filter) {
                    continue
                }
                await callback(event);
            }
        }
    }
}

export async function _updateLoop(client: TelegramClient): Promise<void> {
    while (client.connected) {
        const rnd = helpers.getRandomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
        await helpers.sleep(1000 * 60)
        // We don't care about the result we just want to send it every
        // 60 seconds so telegram doesn't stop the connection
        try {
            client._sender.send(new Api.Ping({
                pingId: bigInt(rnd),
            }))
        } catch (e) {

        }

        // We need to send some content-related request at least hourly
        // for Telegram to keep delivering updates, otherwise they will
        // just stop even if we're connected. Do so every 30 minutes.

        // TODO Call getDifference instead since it's more relevant
        if (!client._lastRequest || new Date().getTime() - client._lastRequest > 30 * 60 * 1000) {
            try {
                await client.invoke(new Api.updates.GetState())
            } catch (e) {

            }
        }
    }
}
