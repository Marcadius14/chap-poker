const { Events, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const {addButtonVar} = require('../commands/utility/availablity');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {

            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            const { cooldowns } = interaction.client;

            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const defaultCooldownDuration = 3;
            const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const expiredTimestamp = Math.round(expirationTime / 1_000);
                    return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            const buttonId = interaction.customId;

            if(buttonId.substring(0, 5) == "avail") {
                const firstUnderscoreIndex = buttonId.indexOf('_');
                const secondUnderscoreIndex = buttonId.indexOf('_', firstUnderscoreIndex + 1);
                const uniqueId = buttonId.substring(secondUnderscoreIndex + 1, secondUnderscoreIndex + 14);

                const row = interaction.message.components[0];
                let origActionRows = interaction.message.components;

                const isCreatorFilter = i => i.user.id === interaction.user.id;
                if (buttonId.substring(0, 12) === 'availConfirm') {
                    const guild = interaction.guild;
                    const members = await guild.members.fetch();

                    origActionRows.pop();

                    const wipeBeforeRequest = await db.query(`DELETE FROM public.availability_requests WHERE user_id='${interaction.user.id}';`);
                            
                    const recordRequest = await db.query(`INSERT INTO public.availability_requests (unique_id, user_id) VALUES('${uniqueId}', '${interaction.user.id}');`);

                    members.forEach(async member => {
                        if(!member.user.bot && (member.id != interaction.user.id)) {
                            const getMessageBeforeWipe = await db.query(`SELECT message_id, rec_user_id FROM public.availability_messages WHERE user_id = '${interaction.user.id}';`);
                            
                            //Close out all previous availability forms
                            getMessageBeforeWipe.rows.forEach(async message => {
                                const msgId = message.message_id;
                                const msgRecUsr = message.rec_user_id;
                                const userRec = await interaction.client.users.fetch(msgRecUsr);
                                const dmChannel = await userRec.createDM();
                                const msg = await dmChannel.messages.fetch(msgId);

                                const remResp = db.query(`DELETE FROM public.availability_status WHERE user_id='${message.rec_user_id}';`);

                                await msg.edit({content: 'This availability form has been closed.', components: []});
                            });

                            const wipeBeforeSave = await db.query(`DELETE FROM public.availability_messages WHERE user_id = '${interaction.user.id}';`);

                            const availMessage = await member.send({content: `${capitalizeFirstLetter(interaction.user.username)} would like to host a poker night on one of the following nights. Click all nights you are available, and they will be highlighted green. If your availability changes, click the button again to grey it out. If a date has at least one person attending, you'll see the total number of people next to it:`, components: origActionRows, filter: isCreatorFilter }).catch(error => console.error(`Could not send message to ${member.user.tag}.`));

                            const saveMessage = await db.query(`INSERT INTO public.availability_messages (unique_id, message_id, user_id, rec_user_id) VALUES('${uniqueId}', '${availMessage.id}', '${interaction.user.id}','${member.id}');`);
                        }
                        else if(member.id === interaction.user.id)
                            interaction.update({ content: `A message has been sent to all users asking for their availability!`, components: [], filter: isCreatorFilter, ephemeral: true });
                    })
                } else {
                    if(interaction.message.content.substring(0, 31) === `If these are the dates you want`) {
                        const actionRows = origActionRows;
                        //Filter out the deleted button
                        const updatedActionRows = actionRows.map(actionRow => {
                            const filteredComponents = actionRow.components.filter(component => component.customId !== buttonId);
                            return new ActionRowBuilder().addComponents(filteredComponents);
                        }).filter(actionRow => actionRow.components.length > 0);
                        
                        await interaction.update({ content: `If these are the dates you want, press the Confirm button. Pressing Confirm will send this message to the channel to ask for everyone\'s availability. You can click on a date to remove it if you cannot host that day:`, components: updatedActionRows, filter: isCreatorFilter, ephemeral: true });
                    } else {
                        const updatedRows = interaction.message.components.map(row => {
                            const newRow = new ActionRowBuilder();

                            row.components.forEach(async button => {
                                let newStyle = button.style;

                                if(button.customId === interaction.customId) {
                                    if(button.style === 3) {
                                        newStyle = 2;
                                        //delete
                                        const remResp = db.query(`DELETE FROM public.availability_status WHERE button_id='${button.customId}' AND user_id='${interaction.user.id}';`);
                                    }
                                    else {
                                        newStyle = 3;
                                        //insert
                                        const labelSubStrIndex = button.label.indexOf(':');
                                        let noCountLabel = button.label;
                                        if(labelSubStrIndex != -1) {
                                            noCountLabel = button.label.substring(0, labelSubStrIndex);
                                           //console.log("noCountLabel is : " + noCountLabel);
                                        }
                                        const addResp = db.query(`INSERT INTO public.availability_status (button_id, user_id, unique_id, buttonLabel) VALUES('${button.customId}', '${interaction.user.id}', '${uniqueId}', '${noCountLabel}');`);
                                    }
                                }
                                
                                newRow.addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(button.customId)
                                        .setLabel(button.label)
                                        .setStyle(newStyle)
                                );
                            });
                            return newRow;
                        })

                        await interaction.update({content: interaction.content, components: updatedRows, filter: isCreatorFilter });

                        //Update all buttons with new totals

                        const getMessagesToUpdate = await db.query(`SELECT message_id, rec_user_id FROM public.availability_messages WHERE unique_id = '${uniqueId}';`);

                        const getLabelCount = await db.query(`select buttonlabel, count(*) as labelCount FROM public.availability_status WHERE unique_id = '${uniqueId}' group by buttonlabel;`);

                        getMessagesToUpdate.rows.forEach(async message => {
                            const msgId = message.message_id;
                            const msgRecUsr = message.rec_user_id;
                            const userRec = await interaction.client.users.fetch(msgRecUsr);
                            const dmChannel = await userRec.createDM();
                            const msg = await dmChannel.messages.fetch(msgId);

                            const updatedRows = msg.components.map(row => {
                                const newRow = new ActionRowBuilder();

                                row.components.forEach(async button => {
                                    let origStyle = button.style;
                                    const labelSubStrIndex = button.label.indexOf(':');
                                    let noCountLabel = button.label;
                                    let labelIndex = -1;
                                    if(labelSubStrIndex != -1) {
                                        noCountLabel = button.label.substring(0, labelSubStrIndex);
                                    }
                                    
                                    labelIndex = getLabelCount.rows.findIndex(lab => lab.buttonlabel === noCountLabel);

                                    if(labelIndex !== -1) {
                                        const newButton = addButtonVar(button.customId, noCountLabel + ": " + getLabelCount.rows[labelIndex].labelcount, origStyle);
                                        newRow.addComponents(newButton);
                                    }
                                    else {
                                        const newButton = addButtonVar(button.customId, noCountLabel, origStyle);
                                        newRow.addComponents(newButton);
                                    }
                                    
                                    //console.log("buttonID: " + button.customId + " buttonLabel: " + button.label);
                                });
                                return newRow;
                            });

                            await msg.edit({content: msg.content, components: updatedRows});
                            //await msg.edit({content: 'This availability form has been closed.', components: []});
                        });
                    }
                }
            }

            if(buttonId.substring(0, 6) == "choose") {
                const firstUnderscoreIndex = buttonId.indexOf('_');
                const origButtonId = buttonId.substring(firstUnderscoreIndex + 1);
                const secondUnderscoreIndex = buttonId.indexOf('_', firstUnderscoreIndex + 1);
                const thirdUnderscoreIndex = buttonId.indexOf('_', secondUnderscoreIndex + 1);
                const uniqueId = buttonId.substring(thirdUnderscoreIndex + 1, thirdUnderscoreIndex + 14);

                const getLabel = await db.query(`SELECT buttonlabel FROM public.availability_status where button_id = '${origButtonId}';`);

                const label = getLabel.rows[0].buttonlabel;

                try {
                    const addResp = await db.query(`INSERT INTO public.confirmed_event (unique_id, host_id, event_date, is_active) VALUES('${uniqueId}', '${interaction.user.id}', '${label}', true);`);
                } catch (error) {
                    console.error(error);
                    await interaction.update({content: `Error confirming date. This usually happens if you've already got a confirmed date. Please run the command again.`, ephemeral: true});
                }

                const getMessageIdsBeforeWipe = await db.query(`SELECT message_id, rec_user_id FROM public.availability_messages WHERE user_id = '${interaction.user.id}';`);
                            
                //Close out all previous availability forms
                getMessageIdsBeforeWipe.rows.forEach(async message => {
                    const msgId = message.message_id;
                    const msgRecUsr = message.rec_user_id;
                    const userRec = await interaction.client.users.fetch(msgRecUsr);
                    const dmChannel = await userRec.createDM();
                    const msg = await dmChannel.messages.fetch(msgId);

                    await msg.edit({content: 'This availability form has been closed.', components: []});
                });

                const delFromMessages = await db.query(`DELETE FROM public.availability_messages WHERE unique_id = '${uniqueId}';`);
                const delFromRequests = await db.query(`DELETE FROM public.availability_requests WHERE unique_id = '${uniqueId}';`);
                const delFromStatus = await db.query(`DELETE FROM public.availability_status WHERE unique_id = '${uniqueId}';`);
                
                await interaction.reply({content: `${capitalizeFirstLetter(interaction.user.username)} has confirmed an event on ${label}!`});
            }
        }
	},
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}