const mongoose = require("mongoose");

const StringSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // sha256 hash used as id
    value: { type: String, required: true },
    properties: {
        length: { type: Number, required: true },

        is_palindrome: { type: Boolean, required: true },

        unique_characters: { type: Number, required: true },

        word_count: { type: Number, required: true },

        sha256_hash: { type: String, required: true },

        character_frequency_map: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    created_at: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model("AnalyzedString", StringSchema);
