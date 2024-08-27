const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('close')
		.setDescription('Closes out an event or availability request and optionally records a winner.')
        .addStringOption(option =>
			option
				.setName('winner')
				.setDescription('Winner of the event')
				.setRequired(false)),
	async execute(interaction) {
        const checkForConfirmedEvents = await db.query(`SELECT unique_id FROM public.confirmed_event where is_active = true and host_id = '${interaction.user.id}' order by event_date desc limit 1;`);

        const checkForAskedAvail = await db.query(`SELECT unique_id FROM public.availability_requests where user_id = '${interaction.user.id}';`);

        if(checkForAskedAvail.rowCount) {
            const uniqueId = checkForAskedAvail.rows[0].unique_id;

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

            await interaction.reply({content: `Done! All availability forms have been closed out. You can now create a new availability request.`, ephemeral: true});
        }else if(checkForConfirmedEvents.rowCount) {
            const setInactive = await db.query(`UPDATE public.confirmed_event SET is_active = false, winner = '${interaction.options.getString('winner')}' where host_id = '${interaction.user.id}';`);

            await interaction.reply({content: `Done! Event is closed out. ${interaction.options.getString('winner')} has been marked as the winner.`, ephemeral: true});
        }
        else {
            await interaction.reply({content: `No events hosted by you are active. Use /availability to start the process!`, ephemeral: true});
        }
	},
};
