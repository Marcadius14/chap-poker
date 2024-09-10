const { ActionRowBuilder, ButtonBuilder, ButtonStyle,SlashCommandBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
    addButtonVar: addButtonVar,
    cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('availability')
		.setDescription('Finds (up to 8) weekend dates in the user\'s given timeframe (MMDDYY format)')
		.addStringOption(option =>
			option
				.setName('startdate')
				.setDescription('The first date in your date range (MMDDYY format)')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('enddate')
				.setDescription('The second date in your date range (MMDDYY format)')
                .setRequired(true)),
	async execute(interaction) {
        const checkForConfirmedEvents = await db.query(`SELECT unique_id, event_date FROM public.confirmed_event where host_id = '${interaction.user.id}' and is_active = true;`);

        const checkForAskedAvail = await db.query(`SELECT user_id FROM public.availability_requests where user_id = '${interaction.user.id}';`);

        if(checkForConfirmedEvents.rowCount) {
            await interaction.reply({content: `You already have an active event. Please close it out using /close before asking for availability.`, ephemeral: true});
        } else if(checkForAskedAvail.rowCount){
            await interaction.reply({content: `You already have an active availability request. Use /close to close it out.`, ephemeral: true});
        }else {
            const startdate = interaction.options.getString('startdate');
            const enddate = interaction.options.getString('enddate') ;

            const newRows = printDateButtons(startdate, enddate, interaction.user.id);

            var response;

            if((await newRows) == "Invalid date length")
            {
                response = await interaction.reply({
                    content: `Invalid number of dates. Please ensure your date range has at least 1 and no greater than 8 valid weekend dates.`,
                    ephemeral: true
                });
            }
            else
            {
                rowsLength = (await newRows).length;

                response = await interaction.reply({
                    content: `If these are the dates you want, press the Confirm button. You can click on a date to remove it if you cannot host that day. Pressing Confirm will send a message to the channel's users to ask for their availability:`,
                    components: (await newRows),
                    ephemeral: true
                });
            }
        }
	},
};

async function printDateButtons(startdate, enddate, userId) 
{
    const dayArray = findFriAndSat(startdate, enddate);

    if((dayArray.length === 0) || (dayArray.length > 8))
    {
        return "Invalid date length"
    }
  
    const rows = createButtons(dayArray, userId);
  
    return rows;
}
  
function findFriAndSat(fromDate, toDate) 
{  
    const startDate = convertToDate(fromDate);
    const endDate = convertToDate(toDate);

    const dates = [];  
    
    while (startDate <= endDate) {     
        if ((startDate.getDay() === 5) || (startDate.getDay() === 6)) {      
        dates.push(startDate.toDateString());    
        }    
        startDate.setDate(startDate.getDate() + 1);  
    }  
     
    return dates;
}
  
function createButtons(dayArray, userId) 
{
    const rowArr = [];
    var buttonArr = [];
    var r = 0;
    const curTimestamp = Date.now();
  
    for (var i = 0; i < dayArray.length; i++) {
        for(var j = 0; j < 2; j++) {
            if(!(i < dayArray.length))
            {
                break;
            }

            let customID = "availid_" + userId.toString() + "_" + curTimestamp + "_" + i.toString();
            let label = dayArray[i];

            buttonArr[j] = addButtonVar(customID, label, "Secondary");
            if(j === 0)
                i++;
        }

        if(buttonArr.length === 1) {
            rowArr[r] = new ActionRowBuilder()
			    .addComponents(buttonArr[0]);
        }
        else {
            rowArr[r] = new ActionRowBuilder()
			    .addComponents(buttonArr[0], buttonArr[1]);
        }

        buttonArr = [];
        r++;
    }
    const confirmButton = addButtonVar("availConfirm_" + userId.toString() + "_" + curTimestamp , "Confirm", "Primary");
    rowArr[r] = new ActionRowBuilder()
			    .addComponents(confirmButton);

    return rowArr;
}

function addButtonVar(customID, label, style)
{
    var button;
    if((style == "Primary") || (style == 1)) {
        button = new ButtonBuilder()
			.setCustomId(customID)
			.setLabel(label)
			.setStyle(ButtonStyle.Primary);
    }
    if((style == "Secondary") || (style == 2)) {
        button = new ButtonBuilder()
			.setCustomId(customID)
			.setLabel(label)
			.setStyle(ButtonStyle.Secondary);
    }
    if((style == "Success") || (style == 3)) {
        button = new ButtonBuilder()
			.setCustomId(customID)
			.setLabel(label)
			.setStyle(ButtonStyle.Success);
    }

    return button;
}

function convertToDate(dateString)
{
    let year = parseInt(dateString.substring(4,6), 10);
    let month = parseInt(dateString.substring(0,2), 10) - 1;
    let day = parseInt(dateString.substring(2,4), 10);

    year += year < 50 ? 2000 : 1900;

    return new Date(year, month, day);
}
