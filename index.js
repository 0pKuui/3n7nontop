require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const ms = require("ms");
const Database = require("@replit/database");
const express = require("express");

const db = new Database();

const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const prefix = ".";

// ================= CASE ID =================
async function getCaseId(guildId) {
    let id = await db.get(`caseid_${guildId}`);
    if (!id) id = 1;
    await db.set(`caseid_${guildId}`, id + 1);
    return id;
}

// ================= RESOLVE USER =================
async function resolveUser(input) {
    if (!input) return null;
    if (input.startsWith("<@")) {
        const id = input.replace(/\D/g, "");
        return await client.users.fetch(id).catch(() => null);
    }
    return await client.users.fetch(input).catch(() => null);
}

// ================= SAVE CASE =================
async function saveCase(guildId, data) {
    let cases = await db.get(`cases_${guildId}`);
    if (!cases) cases = [];

    cases.push(data);

    await db.set(`cases_${guildId}`, cases);
}

// ================= BAN =================
async function ban(msg, args) {
    const user = await resolveUser(args[0]);
    const duration = args[1];
    const reason = args.slice(2).join(" ") || "No reason";

    if (!user) return msg.reply("User not found");

    const member = await msg.guild.members.fetch(user.id).catch(() => null);
    if (!member) return msg.reply("Not in server");

    const caseId = await getCaseId(msg.guild.id);

    await saveCase(msg.guild.id, {
        caseId,
        userId: user.id,
        modId: msg.author.id,
        type: "ban",
        reason,
        duration,
        date: Date.now()
    });

    await msg.guild.members.ban(user.id, { reason });

    msg.reply(`🔨 Banned ${user.tag} | Case #${caseId}`);
}

// ================= KICK =================
async function kick(msg, args) {
    const user = await resolveUser(args[0]);
    const reason = args.slice(1).join(" ") || "No reason";

    if (!user) return msg.reply("User not found");

    const member = await msg.guild.members.fetch(user.id).catch(() => null);
    if (!member) return msg.reply("Not in server");

    const caseId = await getCaseId(msg.guild.id);

    await saveCase(msg.guild.id, {
        caseId,
        userId: user.id,
        modId: msg.author.id,
        type: "kick",
        reason,
        date: Date.now()
    });

    await member.kick(reason);

    msg.reply(`👢 Kicked ${user.tag} | Case #${caseId}`);
}

// ================= TIMEOUT =================
async function timeout(msg, args) {
    const user = await resolveUser(args[0]);
    const duration = args[1];
    const reason = args.slice(2).join(" ") || "No reason";

    if (!user) return msg.reply("User not found");

    const member = await msg.guild.members.fetch(user.id).catch(() => null);
    if (!member) return msg.reply("Not in server");

    const time = ms(duration);
    if (!time) return msg.reply("Invalid duration");

    const caseId = await getCaseId(msg.guild.id);

    await saveCase(msg.guild.id, {
        caseId,
        userId: user.id,
        modId: msg.author.id,
        type: "timeout",
        reason,
        duration,
        date: Date.now()
    });

    await member.timeout(time, reason);

    msg.reply(`⏳ Timed out ${user.tag} | Case #${caseId}`);
}

// ================= WARN =================
async function warn(msg, args) {
    const user = await resolveUser(args[0]);
    const reason = args.slice(1).join(" ") || "No reason";

    if (!user) return msg.reply("User not found");

    const caseId = await getCaseId(msg.guild.id);

    await saveCase(msg.guild.id, {
        caseId,
        userId: user.id,
        modId: msg.author.id,
        type: "warn",
        reason,
        date: Date.now()
    });

    msg.reply(`⚠️ Warned ${user.tag} | Case #${caseId}`);
}

// ================= CASE =================
async function showCase(msg, args) {
    const id = parseInt(args[0]);
    if (!id) return msg.reply("Invalid case ID");

    const cases = await db.get(`cases_${msg.guild.id}`) || [];

    const c = cases.find(x => x.caseId === id);
    if (!c) return msg.reply("Case not found");

    msg.reply(
        `📁 Case #${c.caseId}\nType: ${c.type}\nReason: ${c.reason}`
    );
}

// ================= CASES =================
async function showCases(msg, args) {
    const user = await resolveUser(args[0]);
    if (!user) return msg.reply("User not found");

    const cases = await db.get(`cases_${msg.guild.id}`) || [];

    const filtered = cases.filter(c => c.userId === user.id);

    if (!filtered.length) return msg.reply("No cases");

    msg.reply(
        filtered.map(c => `#${c.caseId} | ${c.type} | ${c.reason}`).join("\n")
    );
}

// ================= COMMAND HANDLER =================
client.on("messageCreate", async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    if (!msg.content.startsWith(prefix)) return;

    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "ban") ban(msg, args);
    if (cmd === "kick") kick(msg, args);
    if (cmd === "timeout") timeout(msg, args);
    if (cmd === "warn") warn(msg, args);
    if (cmd === "case") showCase(msg, args);
    if (cmd === "cases") showCases(msg, args);
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);