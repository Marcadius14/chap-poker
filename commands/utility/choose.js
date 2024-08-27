const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const {addButtonVar} = require('./availablity');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('choose')
		.setDescription('Shows all dates that have at least one available attendee.')
        .addIntegerOption(option =>
			option
				.setName('minplayers')
				.setDescription('The minimum desired number of players needed to host on a given night (ie 4).')
				.setRequired(false)),
	async execute(interaction) {
        const checkForConfirmedEvents = await db.query(`SELECT unique_id, event_date FROM public.confirmed_event where host_id = '${interaction.user.id}' and is_active = true;`);

        if(checkForConfirmedEvents.rowCount) {
            await interaction.reply({content: `You already have a confirmed date on ${checkForConfirmedEvents.rows[0].event_date}!`, ephemeral: true});
        }
        else {
            const checkIfAvailReq = await db.query(`SELECT user_id, unique_id FROM public.availability_requests where user_id = '${interaction.user.id}';`);

            if(checkIfAvailReq.rows === undefined || checkIfAvailReq.rows.length === 0) {
                await interaction.reply({content: `No open availability requests found for your user. Use /availability to send one out!`, ephemeral: true});
            }
            else {
                const unId = checkIfAvailReq.rows[0].unique_id;
                const getCount = await db.query(`SELECT button_id, count(*) as dateCount, buttonlabel FROM public.availability_status where unique_id = '${unId}' group by button_id, buttonlabel ;`);

                const rowArr = [];
                var buttonArr = [];
                var i = 0;

                getCount.rows.forEach(async eventDate => {
                        buttonArr[i] = addButtonVar("chooseid_" + eventDate.button_id, eventDate.buttonlabel + " (" + eventDate.datecount + ")", "Success");
                        i++;
                });

                if(buttonArr.length) {
                    var r = 0;
                    const curTimestamp = Date.now();

                    for(j = 0; j < buttonArr.length; j = j+2) {
                        if((buttonArr.length - j) === 1) {
                            rowArr[r] = new ActionRowBuilder()
                                .addComponents(buttonArr[j]);
                        }
                        else {
                            rowArr[r] = new ActionRowBuilder()
                            .addComponents(buttonArr[j], buttonArr[j+1]);
                        }
                        r++;
                    }

                    await interaction.reply({content: `Below are the nights that have a sufficient number of players to host. Click the date's button to make it official!`, components: (await rowArr), ephemeral: true});
                } else {
                    await interaction.reply({content: `No dates found that match that minimum player count.`, ephemeral: true});
                }            
            }
        }
	},
};