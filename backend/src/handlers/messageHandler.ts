import { WASocket, WAMessage, downloadMediaMessage, WAMessageUpdate } from '@whiskeysockets/baileys';
import { Server } from 'socket.io';
import { messageStore } from '../index';
import { prisma } from '../db';
import fs from 'fs';
import path from 'path';

const fetchingProfilePics = new Set<string>();

export const handleMessageUpsert = async (sock: WASocket, messages: WAMessage[], io: Server) => {
    for (const msg of messages) {
        // Ignorar se não tiver conteúdo de mensagem
        if (!msg.message) continue;

        // Processar revogação (mensagem apagada) mesmo no Upsert
        const rawMessage = msg.message as any;
        let protocolMsg = rawMessage?.protocolMessage || rawMessage?.editedMessage?.message?.protocolMessage;
        let isEdit = false;
        
        if (rawMessage?.editedMessage) { isEdit = true; }
        if (protocolMsg && ((protocolMsg.type as any) === 14 || (protocolMsg.type as any) === 'MESSAGE_EDIT')) { isEdit = true; }
        
        // Tentativa de descriptografar manualmente se Baileys falhou
        if (rawMessage?.secretEncryptedMessage && ((rawMessage.secretEncryptedMessage.secretEncType as any) === 2 || (rawMessage.secretEncryptedMessage.secretEncType as any) === 'MESSAGE_EDIT')) { 
            isEdit = true; 
            
            try {
                const { proto } = require('@whiskeysockets/baileys');
                const { hmacSign, aesDecryptGCM } = require('@whiskeysockets/baileys/lib/Utils/crypto');
                
                const encMsg = rawMessage.secretEncryptedMessage;
                const origMsgId = encMsg.targetMessageKey?.id;
                const origJid = encMsg.targetMessageKey?.remoteJid;
                
                // Buscar chave da mensagem original no store
                const origMsg = messageStore[origMsgId];
                if (origMsg && origMsg.messageContextInfo?.messageSecret) {
                    const secret = origMsg.messageContextInfo.messageSecret;
                    let secretBuf = secret;
                    if (typeof secret === 'string') secretBuf = Buffer.from(secret, 'base64');
                    else if (secret && secret.type === 'Buffer') secretBuf = Buffer.from(secret.data);

                    const encPayload = encMsg.encPayload;
                    let payloadBuf = encPayload;
                    if (typeof encPayload === 'string') payloadBuf = Buffer.from(encPayload, 'base64');
                    else if (encPayload && encPayload.type === 'Buffer') payloadBuf = Buffer.from(encPayload.data);

                    const encIv = encMsg.encIv;
                    let ivBuf = encIv;
                    if (typeof encIv === 'string') ivBuf = Buffer.from(encIv, 'base64');
                    else if (encIv && encIv.type === 'Buffer') ivBuf = Buffer.from(encIv.data);

                    const toBinary = (txt: string) => Buffer.from(txt);
                    const possibleSenders = [
                        origJid,
                        origJid?.replace(/@lid$/, '@s.whatsapp.net'),
                        msg.key.remoteJid,
                        msg.key.participant,
                        origMsgId // just in case
                    ].filter(Boolean);

                    let decryptedProto = null;
                    for (let s of possibleSenders) {
                        try {
                            const senderBuf = toBinary(s as string);
                            const sign = Buffer.concat([ toBinary(origMsgId), senderBuf, senderBuf, toBinary('Message Edit'), new Uint8Array([1]) ]);
                            const key0 = hmacSign(secretBuf, new Uint8Array(32));
                            const decKey = hmacSign(sign, key0);
                            const decrypted = aesDecryptGCM(payloadBuf, decKey, ivBuf, Buffer.alloc(0));
                            decryptedProto = proto.Message.decode(decrypted);
                            break;
                        } catch(e) {}
                    }

                    if (decryptedProto) {
                        protocolMsg = decryptedProto.protocolMessage || decryptedProto.editedMessage?.message?.protocolMessage || decryptedProto;
                    }
                }
            } catch(e) {
                console.error("Erro na descriptografia manual de edicao:", e);
            }
        }

        if (protocolMsg) {
            const type = protocolMsg.type;
            const key = protocolMsg.key;
            if (key && key.id) {
                if (type === 0 || type === 'REVOKE') { // REVOKE (Apagar mensagem)
                    const msgDb = await prisma.message.findUnique({ where: { messageId: key.id }});
                    if (msgDb) {
                        await prisma.message.update({
                            where: { id: msgDb.id },
                            data: { isDeleted: true }
                        });
                        io.emit('message-deleted', { messageId: msgDb.messageId, ticketId: msgDb.ticketId });
                    }
                    continue;
                } else if (isEdit) { // MESSAGE_EDIT (Editar mensagem)
                    fs.appendFileSync('edit_debug.txt', `[UPSERT] Inside isEdit block, key.id: ${key.id}\n`);
                    const msgDb = await prisma.message.findUnique({ where: { messageId: key.id }});
                    if (msgDb && protocolMsg.editedMessage) {
                        // Extract edited content
                        const editedRealMsg = protocolMsg.editedMessage;
                        const editedContent = editedRealMsg.conversation || editedRealMsg.extendedTextMessage?.text || '';
                        fs.appendFileSync('edit_debug.txt', `[UPSERT] Found msgDb. Updating DB with content: ${editedContent}\n`);
                        
                        await prisma.message.update({
                            where: { id: msgDb.id },
                            data: { content: editedContent, isEdited: true, oldContent: msgDb.content } as any
                        });
                        io.emit('message-edited', { messageId: msgDb.messageId, ticketId: msgDb.ticketId, content: editedContent, oldContent: msgDb.content });
                    } else {
                        fs.appendFileSync('edit_debug.txt', `[UPSERT] msgDb found: ${!!msgDb}, editedMessage exists: ${!!protocolMsg.editedMessage}\n`);
                    }
                    continue; // Sempre ignora a criacao de nova mensagem se for uma edição
                }
            }
        }

        // Catch-all para ignorar criacao de mensagem para edicoes, mesmo se der erro ao processar acima
        if (isEdit) {
            fs.appendFileSync('edit_debug.txt', `[UPSERT] Hit catch-all\n`);
            continue;
        }

        // Ignorar mensagens de protocolo/sistema do WhatsApp
        const isProtocol = rawMessage.protocolMessage || 
                           rawMessage.senderKeyDistributionMessage || 
                           rawMessage.peerDataOperationRequestMessage ||
                           rawMessage.connectionMessage ||
                           rawMessage.historySyncNotification;
        if (isProtocol) continue;

        const realMsgObj = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
        
        if (realMsgObj?.reactionMessage) {
            const reaction = realMsgObj.reactionMessage;
            const targetMsgKey = reaction.key;
            if (targetMsgKey && targetMsgKey.id) {
                try {
                    const emojiText = reaction.text || ''; 
                    const msgDb = await prisma.message.findUnique({ where: { messageId: targetMsgKey.id }});
                    if (msgDb) {
                        await prisma.message.update({
                            where: { id: msgDb.id },
                            data: { reaction: emojiText === '' ? null : emojiText }
                        });
                        io.emit('message-reaction', { messageId: msgDb.messageId, ticketId: msgDb.ticketId, reaction: emojiText === '' ? null : emojiText });
                    }
                } catch (e) {
                    console.log('Erro ao processar reaction', e);
                }
            }
            continue;
        }

        const messageId = msg.key.id;
        if (messageId) {
            const exists = await prisma.message.findUnique({ where: { messageId } });
            if (exists) continue; // Mensagem já salva (ex: enviada pelo próprio CRM)
        }

        // Extrair o JID de quem enviou (número do cliente)
        const remoteJid = msg.key.remoteJid;
        const remoteJidAlt = (msg.key as any).remoteJidAlt;
        const participant = msg.key.participant;
        console.log('--- NOVA MENSAGEM ---');
        console.log('remoteJid:', remoteJid);
        console.log('remoteJidAlt:', remoteJidAlt);
        console.log('participant:', participant);
        
        // Ignora status e listas de transmissão
        if (msg.broadcast || !remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.includes('@g.us');

        // Usar remoteJidAlt (se existir) converte o LID no JID real automaticamente
        let jidNormalizado = remoteJidAlt || remoteJid;

        // Tratamento do JID: o JID recebido na mensagem (remoteJid ou remoteJidAlt) já é o correto
        // Não é necessário chamar sock.onWhatsApp() aqui, pois isso causa gargalos de até 60s em cada mensagem.

        // Descobrir o nome do contato se vier no pushName (apenas para mensagens recebidas, para evitar sobrescrever com o nome do dono da conta)
        const pushName = msg.key.fromMe ? null : msg.pushName;

        // 1. Procurar ou criar o Contact
        let contact = await prisma.contact.findUnique({
            where: { jid: jidNormalizado }
        });

        const numberOnly = jidNormalizado.split('@')[0];
        const needsNameUpdate = contact && (contact.name === numberOnly || contact.name === 'Desconhecido' || !contact.name);

        if (!contact || needsNameUpdate) {
            let finalName = pushName || numberOnly;

            // Se for um grupo e estamos sem o nome correto, buscar os metadados do grupo
            if (isGroup) {
                try {
                    const metadata = await sock.groupMetadata(jidNormalizado);
                    if (metadata && metadata.subject) {
                        finalName = metadata.subject;
                    }
                } catch (err) {
                    console.log(`[DEBUG] Falha ao buscar nome do grupo ${jidNormalizado}`);
                }
            }

            if (!contact) {
                contact = await prisma.contact.create({
                    data: {
                        jid: jidNormalizado,
                        name: finalName,
                        whatsappName: pushName || null,
                        profilePicUrl: null
                    }
                });
            } else {
                contact = await prisma.contact.update({
                    where: { id: contact.id },
                    data: { 
                        name: finalName,
                        ...(pushName && !isGroup ? { whatsappName: pushName } : {})
                    }
                });
            }
        } else if (pushName && !isGroup) {
            // Se já tem nome e não é grupo, a lógica de não sobrescrever nomes da agenda foi garantida.
            // Mas DEVEMOS atualizar o whatsappName se ele for diferente!
            if (contact.whatsappName !== pushName) {
                contact = await prisma.contact.update({
                    where: { id: contact.id },
                    data: { whatsappName: pushName }
                });
            }
        }

        // Tentar baixar a foto de perfil em background se o contato ainda não tiver foto
        if (!contact.profilePicUrl && !fetchingProfilePics.has(jidNormalizado)) {
            fetchingProfilePics.add(jidNormalizado);
            (async () => {
                try {
                    const url = await getProfilePictureUrlWithRetry(sock, jidNormalizado);

                    if (url) {
                        // Baixar a imagem e salvar localmente!
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Falha HTTP: ${response.status}`);
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);

                        const profileDir = path.join(process.cwd(), 'public', 'profilepics');
                        if (!fs.existsSync(profileDir)) {
                            fs.mkdirSync(profileDir, { recursive: true });
                        }
                        
                        const fileName = `${contact.id}.jpg`;
                        const savePath = path.join(profileDir, fileName);
                        fs.writeFileSync(savePath, buffer);

                        const localUrl = `/profilepics/${fileName}`;

                        await prisma.contact.update({
                            where: { id: contact.id },
                            data: { profilePicUrl: localUrl }
                        });
                        io.emit('contact-updated', { id: contact.id, profilePicUrl: localUrl });
                    }
                } catch (err: any) {
                    console.log(`[DEBUG] Falha ao baixar foto para ${jidNormalizado}:`, err.message || err);
                } finally {
                    // Remover do set para permitir tentar novamente depois se falhou
                    fetchingProfilePics.delete(jidNormalizado);
                }
            })();
        }

        // 2. Procurar ticket
        let ticket;
        if (isGroup) {
            // Grupos têm apenas UM ticket fixo com status 'Grupo'
            ticket = await prisma.ticket.findFirst({
                where: { contactId: contact.id, status: 'Grupo' }
            });
            if (!ticket) {
                ticket = await prisma.ticket.create({
                    data: { contactId: contact.id, status: 'Grupo', unreadCount: msg.key.fromMe ? 0 : 1 },
                    include: { contact: true, user: { select: { name: true } } }
                });
                io.emit('new-ticket', ticket);
            } else {
                ticket = await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: { updatedAt: new Date(), ...(msg.key.fromMe ? {} : { unreadCount: { increment: 1 } }) },
                    include: { contact: true, user: { select: { name: true } } }
                });
                io.emit('ticket-updated', ticket);
            }
        } else {
            // Lógica normal para 1-a-1
            ticket = await prisma.ticket.findFirst({
                where: {
                    contactId: contact.id,
                    status: {
                        in: ['Em espera', 'Em atendimento']
                    }
                },
                include: { contact: true, user: { select: { name: true } }, sector: true }
            });

            if (!ticket) {
                const settings = await prisma.setting.findMany({
                    where: { key: { in: ['ticketReopenThreshold', 'greetingMessage', 'botEnabled'] } }
                });
                const getSetting = (k: string) => settings.find(s => s.key === k)?.value;

                let reopenMs = 30 * 1000;
                const reopenMinStr = getSetting('ticketReopenThreshold');
                if (reopenMinStr && !isNaN(parseInt(reopenMinStr))) {
                    reopenMs = parseInt(reopenMinStr) * 60 * 1000;
                }
                const thresholdDate = new Date(Date.now() - reopenMs);

                const recentClosedTicket = await prisma.ticket.findFirst({
                    where: {
                        contactId: contact.id,
                        status: 'Finalizado',
                        updatedAt: { gte: thresholdDate }
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (recentClosedTicket) {
                    ticket = await prisma.ticket.update({
                        where: { id: recentClosedTicket.id },
                        data: { status: 'Em espera', userId: null, sectorId: null, updatedAt: new Date(), ...(msg.key.fromMe ? {} : { unreadCount: { increment: 1 } }) },
                        include: { contact: true, user: { select: { name: true } }, sector: true }
                    });
                    io.emit('ticket-updated', ticket);
                } else {
                    const isFromAgent = msg.key.fromMe || false;
                    ticket = await prisma.ticket.create({
                        data: { contactId: contact.id, status: 'Em espera', unreadCount: isFromAgent ? 0 : 1, botSkipped: isFromAgent },
                        include: { contact: true, user: { select: { name: true } }, sector: true }
                    });
                    io.emit('new-ticket', ticket);
                }

                const botEnabledStr = getSetting('botEnabled');
                const botEnabled = botEnabledStr ? botEnabledStr === 'true' : true;

                // ROTEAMENTO: Enviar menu ou auto-associar (apenas se a mensagem veio de fora, e não do dono do número)
                if (!msg.key.fromMe && botEnabled) {
                    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
                    if (sectors.length > 1) {
                        const customGreeting = getSetting('greetingMessage');
                        const greetingPrefix = customGreeting ? `${customGreeting}\n\n` : `Olá! Por favor, selecione o setor para prosseguir digitando o número correspondente:\n\n`;
                        const menuText = greetingPrefix + sectors.map((s, i) => `*${i + 1}* - ${s.name}`).join('\n');
                        const sentMsg = await sock.sendMessage(jidNormalizado, { text: menuText });
                        await prisma.message.create({
                            data: {
                                ticketId: ticket.id,
                                messageId: sentMsg?.key.id || '',
                                type: 'text',
                                content: menuText,
                                sender: 'Sistema'
                            }
                        });
                    } else if (sectors.length === 1) {
                        ticket = await prisma.ticket.update({
                            where: { id: ticket.id },
                            data: { sectorId: sectors[0].id },
                            include: { contact: true, user: { select: { name: true } }, sector: true }
                        });
                        io.emit('ticket-updated', ticket);

                        const sentMsg = await sock.sendMessage(jidNormalizado, { text: sectors[0].message });
                        await prisma.message.create({
                            data: {
                                ticketId: ticket.id,
                                messageId: sentMsg?.key.id || '',
                                type: 'text',
                                content: sectors[0].message,
                                sender: 'Sistema'
                            }
                        });
                    }
                }
            } else {
                // Ticket já existe. Verificar se precisa de seleção de setor (apenas se for mensagem de cliente)
                const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
                
                if (msg.key.fromMe && !ticket.botSkipped) {
                    ticket = await prisma.ticket.update({
                        where: { id: ticket.id },
                        data: { botSkipped: true, updatedAt: new Date() },
                        include: { contact: true, user: { select: { name: true } }, sector: true }
                    });
                    io.emit('ticket-updated', ticket);
                } else if (!msg.key.fromMe && ticket.status === 'Em espera' && ticket.sectorId === null && !ticket.botSkipped && sectors.length > 1) {
                    // Extrair conteúdo em texto
                    const realMessage = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
                    const messageContent = (realMessage?.conversation || realMessage?.extendedTextMessage?.text || '').trim();
                    const choice = parseInt(messageContent, 10);

                    if (!isNaN(choice) && choice > 0 && choice <= sectors.length) {
                        const chosenSector = sectors[choice - 1];
                        ticket = await prisma.ticket.update({
                            where: { id: ticket.id },
                            data: { sectorId: chosenSector.id, ...(msg.key.fromMe ? {} : { unreadCount: { increment: 1 } }) },
                            include: { contact: true, user: { select: { name: true } }, sector: true }
                        });
                        io.emit('ticket-updated', ticket);

                        const sentMsg = await sock.sendMessage(jidNormalizado, { text: chosenSector.message });
                        await prisma.message.create({
                            data: {
                                ticketId: ticket.id,
                                messageId: sentMsg?.key.id || '',
                                type: 'text',
                                content: chosenSector.message,
                                sender: 'Sistema'
                            }
                        });
                    } else {
                        const botMaxRetriesSetting = await prisma.setting.findUnique({ where: { key: 'botMaxRetries' } });
                        const botMaxRetries = botMaxRetriesSetting?.value ? parseInt(botMaxRetriesSetting.value, 10) : 3;
                        
                        if (ticket.botRetries >= botMaxRetries - 1) {
                            ticket = await prisma.ticket.update({
                                where: { id: ticket.id },
                                data: { botSkipped: true, unreadCount: { increment: 1 } },
                                include: { contact: true, user: { select: { name: true } }, sector: true }
                            });
                            io.emit('ticket-updated', ticket);

                            const fallbackText = "Poxa, não consegui entender qual o setor você deseja. Vou envia-lo para a lista de atendimento de um de nossos agentes.";
                            const sentMsg = await sock.sendMessage(jidNormalizado, { text: fallbackText });
                            await prisma.message.create({
                                data: {
                                    ticketId: ticket.id,
                                    messageId: sentMsg?.key.id || '',
                                    type: 'text',
                                    content: fallbackText,
                                    sender: 'Sistema'
                                }
                            });
                        } else {
                            ticket = await prisma.ticket.update({
                                where: { id: ticket.id },
                                data: { botRetries: { increment: 1 }, unreadCount: { increment: 1 } },
                                include: { contact: true, user: { select: { name: true } }, sector: true }
                            });
                            io.emit('ticket-updated', ticket);

                            // Reenviar menu informando erro
                            const menuText = `Opção inválida. Por favor, selecione o setor digitando o número correspondente:\n\n` +
                                             sectors.map((s, i) => `*${i + 1}* - ${s.name}`).join('\n');
                            const sentMsg = await sock.sendMessage(jidNormalizado, { text: menuText });
                            await prisma.message.create({
                                data: {
                                    ticketId: ticket.id,
                                    messageId: sentMsg?.key.id || '',
                                    type: 'text',
                                    content: menuText,
                                    sender: 'Sistema'
                                }
                            });
                        }
                    }
                } else {
                    ticket = await prisma.ticket.update({
                        where: { id: ticket.id },
                        data: { updatedAt: new Date(), ...(msg.key.fromMe ? {} : { unreadCount: { increment: 1 } }) },
                        include: { contact: true, user: { select: { name: true } }, sector: true }
                    });
                    io.emit('ticket-updated', ticket);
                }
            }
        }

        // 3. Processar conteúdo da mensagem (texto ou mídia)
        let messageType = 'text';
        let originalFileName: string | null = null;
        let mediaUrl: string | null = null;
        
        // Suporte para mensagens temporárias e viewOnce
        let realMessage = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message?.documentWithCaptionMessage?.message || msg.message;
        
        let messageContent = realMessage?.conversation || 
                             realMessage?.extendedTextMessage?.text || 
                             realMessage?.imageMessage?.caption || 
                             realMessage?.videoMessage?.caption || 
                             realMessage?.documentMessage?.caption || '';

        if (!messageContent) {
            if (realMessage?.templateMessage?.hydratedTemplate?.hydratedContentText) {
                messageContent = realMessage.templateMessage.hydratedTemplate.hydratedContentText;
            } else if (realMessage?.buttonsMessage?.contentText) {
                messageContent = realMessage.buttonsMessage.contentText;
            } else if (realMessage?.interactiveMessage?.body?.text) {
                messageContent = realMessage.interactiveMessage.body.text;
            }
        }

        const docMsg = realMessage?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;

        // Se tiver mídia
        const hasMedia = realMessage?.imageMessage || realMessage?.videoMessage || realMessage?.audioMessage || docMsg || realMessage?.stickerMessage;
        
        if (hasMedia) {
            try {
                if (realMessage?.imageMessage) messageType = 'image';
                else if (realMessage?.videoMessage) messageType = 'video';
                else if (realMessage?.audioMessage) messageType = 'audio';
                else if (docMsg) messageType = 'document';
                else if (realMessage?.stickerMessage) messageType = 'sticker';

                const buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    { },
                    { 
                        logger: sock.logger as any,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );

                let extension = 'bin';
                if (messageType === 'image') extension = 'jpg';
                else if (messageType === 'video') extension = 'mp4';
                else if (messageType === 'audio') extension = 'ogg';
                else if (messageType === 'document') {
                    if (docMsg?.fileName) {
                        originalFileName = docMsg.fileName;
                        const parts = originalFileName.split('.');
                        if (parts.length > 1) {
                            extension = parts[parts.length - 1];
                        }
                    } else if (docMsg?.mimetype === 'application/pdf') {
                        extension = 'pdf';
                        originalFileName = 'documento.pdf';
                    }
                }
                else if (messageType === 'sticker') extension = 'webp';

                const fileName = `${msg.key.id}.${extension}`;
                const saveDir = path.join(process.cwd(), 'public', 'uploads');
                if (!fs.existsSync(saveDir)) {
                    fs.mkdirSync(saveDir, { recursive: true });
                }
                const savePath = path.join(saveDir, fileName);
                
                fs.writeFileSync(savePath, buffer as Buffer);
                mediaUrl = `/uploads/${fileName}`; // Salva apenas o caminho para servir no front
            } catch (error) {
                console.error("Erro ao baixar mídia:", error);
                messageContent = "[Erro ao baixar mídia]";
            }
        }

        if (!messageContent && !hasMedia) {
            // Pode ser sistema, etc
            if (realMessage?.protocolMessage) {
                // Ignorar mensagens de sistema internas (ex: EPHEMERAL_SYNC_RESPONSE)
                continue;
            } else if ((realMessage?.secretEncryptedMessage?.secretEncType as any) === 'MESSAGE_EDIT' || (realMessage?.secretEncryptedMessage?.secretEncType as any) === 2) {
                // Ignorar as mensagens criptografadas de edição; o Baileys vai processar e mandar pro messages.update
                continue;
            } else {
                messageContent = "📎 [Mensagem de formato não suportado ou vazia]";
                try {
                    const dump = JSON.stringify(msg, (key, value) => {
                        if (typeof value === 'bigint') return value.toString();
                        return value;
                    }, 2);
                    fs.writeFileSync(path.join(process.cwd(), `debug_msg_${Date.now()}.json`), dump);
                } catch(e) {
                    fs.writeFileSync(path.join(process.cwd(), `debug_msg_${Date.now()}_error.txt`), String(e));
                }
            }
        }

        // Determinar o Sender
        let messageSender = msg.key.fromMe ? 'Sistema' : 'Cliente';
        if (isGroup && !msg.key.fromMe) {
            const part = participant ? participant.split('@')[0] : 'Alguém';
            messageSender = pushName || part;
        }

        const quotedMsgInfo = realMessage?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMsgId = realMessage?.extendedTextMessage?.contextInfo?.stanzaId || null;
        let quotedMsgBody = null;
        
        if (quotedMsgInfo) {
            quotedMsgBody = quotedMsgInfo.conversation || 
                            quotedMsgInfo.extendedTextMessage?.text || 
                            quotedMsgInfo.imageMessage?.caption || 
                            quotedMsgInfo.videoMessage?.caption || 
                            quotedMsgInfo.documentMessage?.caption || 
                            '📎 [Mídia]';
        }

        // 4. Salvar a Mensagem no DB
        const savedMessage = await prisma.message.create({
            data: {
                ticketId: ticket.id,
                messageId: msg.key.id || '',
                type: messageType,
                content: messageContent,
                mediaUrl: mediaUrl,
                fileName: originalFileName,
                sender: messageSender,
                quotedMsgId: quotedMsgId,
                quotedMsgBody: quotedMsgBody,
                timestamp: new Date((msg.messageTimestamp as number) * 1000)
            }
        });

        // Se o cliente respondeu a uma mensagem do sistema, force o status de lida (ack=4)
        if (quotedMsgId && !msg.key.fromMe) {
            const qMsg = await prisma.message.findUnique({ where: { messageId: quotedMsgId } });
            if (qMsg && qMsg.sender === 'Sistema' && qMsg.ack < 4) {
                await prisma.message.update({
                    where: { id: qMsg.id },
                    data: { ack: 4 }
                });
                io.emit('message-ack', { messageId: qMsg.messageId, ack: 4, ticketId: ticket.id });
            }
        }

        // Emitir nova mensagem via Socket
        io.emit('new-message', savedMessage);
    }
};

export const handleMessageUpdate = async (updates: WAMessageUpdate[], io: Server) => {
    for (const update of updates) {
        if (!update.update.status) {
            fs.appendFileSync('edit_debug.txt', `\n[UPDATE] Message Update Recebido para ${update.key.id}\n`);
            try {
                fs.appendFileSync('edit_debug.txt', `[UPDATE] payload: ${JSON.stringify(update.update, (k, v) => typeof v === 'bigint' ? v.toString() : v)}\n`);
            } catch(e){}
        }

        // Se a mensagem foi revogada (apagada)
        const protocolMsg = update.update.message?.protocolMessage;
        if (protocolMsg && ((protocolMsg.type as any) === 0 || (protocolMsg.type as any) === 'REVOKE')) { // Tipo 0 = Revoke
            try {
                const revokeMsgId = protocolMsg.key?.id;
                if (!revokeMsgId) continue;
                const msgDb = await prisma.message.findUnique({ where: { messageId: revokeMsgId }});
                if (msgDb) {
                    await prisma.message.update({
                        where: { id: msgDb.id },
                        data: { isDeleted: true }
                    });
                    io.emit('message-deleted', { messageId: msgDb.messageId, ticketId: msgDb.ticketId });
                }
            } catch (e) {
                console.log('Erro ao atualizar DB no Revoke (Update)', e);
            }
            continue;
        }

        // Se a mensagem foi editada (descriptografada pelo store)
        let isEdit = false;
        let editedText = '';
        let originalMsgId = '';

        if (update.update.message?.editedMessage?.message?.protocolMessage) {
            const editProtocol = update.update.message.editedMessage.message.protocolMessage;
            originalMsgId = editProtocol.key?.id || '';
            editedText = editProtocol.editedMessage?.conversation || editProtocol.editedMessage?.extendedTextMessage?.text || '';
            if (originalMsgId && editedText) isEdit = true;
            fs.appendFileSync('edit_debug.txt', `[UPDATE] Found editedMessage inside update. originalMsgId: ${originalMsgId}\n`);
        } else if (protocolMsg && ((protocolMsg.type as any) === 14 || (protocolMsg.type as any) === 'MESSAGE_EDIT')) {
            originalMsgId = protocolMsg.key?.id || '';
            editedText = protocolMsg.editedMessage?.conversation || protocolMsg.editedMessage?.extendedTextMessage?.text || '';
            if (originalMsgId && editedText) isEdit = true;
            fs.appendFileSync('edit_debug.txt', `[UPDATE] Found protocolMsg type 14 inside update. originalMsgId: ${originalMsgId}\n`);
        }

        if (isEdit) {
            try {
                fs.appendFileSync('edit_debug.txt', `[UPDATE] Updating DB for ${originalMsgId} to ${editedText}\n`);
                const msgDb = await prisma.message.findUnique({ where: { messageId: originalMsgId }});
                if (msgDb) {
                    await prisma.message.update({
                        where: { id: msgDb.id },
                        data: { content: editedText, isEdited: true, oldContent: msgDb.content } as any
                    });
                    io.emit('message-edited', { messageId: msgDb.messageId, ticketId: msgDb.ticketId, content: editedText, oldContent: msgDb.content });
                } else {
                    fs.appendFileSync('edit_debug.txt', `[UPDATE] Failed to find msgDb for originalMsgId ${originalMsgId}\n`);
                }
            } catch (e) {
                console.log('Erro ao atualizar edicao no DB via update', e);
            }
            continue;
        }

        // Message ack status
        if (update.update.status !== undefined && update.update.status !== null && update.key.id) {
            const statusNumber = update.update.status;
            const msgDb = await prisma.message.findUnique({ where: { messageId: update.key.id }});
            // Apenas atualiza se o novo status for MAIOR que o atual (evita downgrades por eventos atrasados do WhatsApp)
            if (msgDb && statusNumber > msgDb.ack) {
                await prisma.message.update({
                    where: { id: msgDb.id },
                    data: { ack: statusNumber }
                });
                io.emit('message-ack', { messageId: msgDb.messageId, ack: statusNumber, ticketId: msgDb.ticketId });
            }
        }
    }
};

export async function getProfilePictureUrlWithRetry(sock: any, jid: string): Promise<string | null> {
    const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
    
    const queryUrl = async (targetJid: string, type: 'image' | 'preview') => {
        return await Promise.race([
            sock.profilePictureUrl(targetJid, type),
            timeoutPromise(5000)
        ]) as string;
    };

    try {
        const url = await queryUrl(jid, 'image');
        if (url) return url;
    } catch (err: any) {
        console.log(`[DEBUG] Erro image para ${jid}:`, err.message || err);
    }

    try {
        const url = await queryUrl(jid, 'preview');
        if (url) return url;
    } catch (err: any) {
        console.log(`[DEBUG] Erro preview para ${jid}:`, err.message || err);
    }

    return null;
}

