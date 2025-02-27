import {ChatGetter} from "./chatGetter";
import {SenderGetter} from "./senderGetter";
import {Api} from "../api";
import type {TelegramClient} from "../../client/TelegramClient";
import type {Entity} from "../../define";
import {_EntityType, _entityType} from "../../Helpers";
import {_getEntityPair, getPeerId} from "../../Utils";


export class Forward {
    private originalFwd: Api.MessageFwdHeader;

    constructor(client: TelegramClient, original: Api.MessageFwdHeader, entities: Map<number, Entity>) {
        // Copy all objects here. probably need a better way tho. PRs are welcome
        Object.assign(this, original);
        this.originalFwd = original;

        let senderId = undefined;
        let sender = undefined;
        let inputSender = undefined;
        let peer = undefined;
        let chat = undefined;
        let inputChat = undefined;
        if (original.fromId) {
            const ty = _entityType(original.fromId);
            if (ty === _EntityType.USER) {
                senderId = getPeerId(original.fromId);
                [sender, inputSender] = _getEntityPair(senderId, entities, client._entityCache);
            } else if (ty === _EntityType.CHANNEL || ty === _EntityType.CHAT) {
                peer = original.fromId;
                [chat, inputChat] = _getEntityPair(getPeerId(peer), entities, client._entityCache);
            }
        }
        ChatGetter.initClass(this, {
            chatPeer: peer,
            inputChat: inputChat

        });
        SenderGetter.initClass(this, {
            senderId: senderId,
            sender: sender,
            inputSender: inputSender,
        });
        this._client = client;


    }

}

export interface Forward extends ChatGetter, SenderGetter {
}

