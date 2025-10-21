// ...existing code...
const AnalyzedString = require("../models/stringModel");
const { analyze, sha256Hex } = require("../utils/analyzer");
const { parseNaturalLanguage } = require("../utils/nlParser");


async function createString(req, res) {
  try {
    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(422).json({ error: '"value" field is required' });
    }
    if (typeof value !== "string") {
      return res.status(422).json({ error: '"value" must be a string' });
    }

    const properties = analyze(value);
    const id = properties.sha256_hash;

    // If record exists -> 409
    const existing = await AnalyzedString.findById(id).lean();
    if (existing) {
      return res.status(409).json({ error: "String already exists", id });
    }

    const doc = {
      _id: id,
      value,
      properties,
      created_at: new Date()
    };

    await AnalyzedString.create(doc);

    return res.status(201).json({
      id,
      value,
      properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/:string_value
 * We accept the path param as the raw string value.
 * We compute its SHA-256 and lookup by that id.
 */
async function getStringByValue(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined || raw === null) return res.status(422).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "String not found" });

    return res.status(200).json({
      id: doc._id,
      value: doc.value,
      properties: doc.properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings
 * Query params:
 *   is_palindrome (true/false)
 *   min_length (int)
 *   max_length (int)
 *   word_count (int)
 *   contains_character (single char)
 */
async function getAllStrings(req, res) {
  try {
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character
    } = req.query;

    // validate & build mongo query
    const q = {};

    if (is_palindrome !== undefined) {
      if (is_palindrome !== "true" && is_palindrome !== "false") {
        return res.status(422).json({ error: "is_palindrome must be true or false" });
      }
      q["properties.is_palindrome"] = is_palindrome === "true";
    }

    if (min_length !== undefined) {
      const n = parseInt(min_length, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "min_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $gte: n });
    }

    if (max_length !== undefined) {
      const n = parseInt(max_length, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "max_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $lte: n });
    }

    if (word_count !== undefined) {
      const n = parseInt(word_count, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "word_count must be integer" });
      q["properties.word_count"] = n;
    }

    if (contains_character !== undefined) {
      if (typeof contains_character !== "string" || contains_character.length !== 1) {
        return res.status(422).json({ error: "contains_character must be a single character" });
      }
      const ch = contains_character.toLowerCase();
      q[`properties.character_frequency_map.${ch}`] = { $exists: true, $gt: 0 };
    }

    const docs = await AnalyzedString.find(q).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      filters_applied: {
        ...(is_palindrome !== undefined ? { is_palindrome: is_palindrome === "true" } : {}),
        ...(min_length !== undefined ? { min_length: parseInt(min_length, 10) } : {}),
        ...(max_length !== undefined ? { max_length: parseInt(max_length, 10) } : {}),
        ...(word_count !== undefined ? { word_count: parseInt(word_count, 10) } : {}),
        ...(contains_character !== undefined ? { contains_character: contains_character.toLowerCase() } : {})
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/filter-by-natural-language?query=...
 * Uses nlParser to construct filters, then reuses getAllStrings-like behavior.
 */
async function filterByNaturalLanguage(req, res) {
  try {
    const q = req.query.query;
    if (!q) return res.status(422).json({ error: "query parameter is required" });

    let parsed;
    try {
      parsed = parseNaturalLanguage(q);
    } catch (err) {
      if (err.code === "UNPARSEABLE") {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // Now convert parsed to the same query used above
    const mongoQuery = {};

    if (parsed.is_palindrome !== undefined) mongoQuery["properties.is_palindrome"] = Boolean(parsed.is_palindrome);
    if (parsed.min_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $gte: parsed.min_length });
    if (parsed.max_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $lte: parsed.max_length });
    if (parsed.word_count !== undefined) mongoQuery["properties.word_count"] = parsed.word_count;
    if (parsed.contains_character !== undefined) {
      const ch = String(parsed.contains_character).toLowerCase();
      if (ch.length === 1) {
        mongoQuery[`properties.character_frequency_map.${ch}`] = { $exists: true, $gt: 0 };
      }
    }

    const docs = await AnalyzedString.find(mongoQuery).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      interpreted_query: {
        original: q,
        parsed_filters: parsed
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /strings/:string_value
 * Compute sha256 and remove by id
 */
async function deleteString(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined || raw === null) return res.status(422).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "String not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createString,
  getStringByValue,
  getAllStrings,
  filterByNaturalLanguage,
  deleteString
};
// ...existing code...// ...existing code...
const AnalyzedString = require("../models/stringModel");
const { analyze, sha256Hex } = require("../utils/analyzer");
const { parseNaturalLanguage } = require("../utils/nlParser");


async function createString(req, res) {
  try {
    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(422).json({ error: '"value" field is required' });
    }
    if (typeof value !== "string") {
      return res.status(422).json({ error: '"value" must be a string' });
    }

    const properties = analyze(value);
    const id = properties.sha256_hash;

    // If record exists -> 409
    const existing = await AnalyzedString.findById(id).lean();
    if (existing) {
      return res.status(409).json({ error: "String already exists", id });
    }

    const doc = {
      _id: id,
      value,
      properties,
      created_at: new Date()
    };

    await AnalyzedString.create(doc);

    return res.status(201).json({
      id,
      value,
      properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/:string_value
 * We accept the path param as the raw string value.
 * We compute its SHA-256 and lookup by that id.
 */
async function getStringByValue(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined || raw === null) return res.status(422).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "String not found" });

    return res.status(200).json({
      id: doc._id,
      value: doc.value,
      properties: doc.properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings
 * Query params:
 *   is_palindrome (true/false)
 *   min_length (int)
 *   max_length (int)
 *   word_count (int)
 *   contains_character (single char)
 */
async function getAllStrings(req, res) {
  try {
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character
    } = req.query;

    // validate & build mongo query
    const q = {};

    if (is_palindrome !== undefined) {
      if (is_palindrome !== "true" && is_palindrome !== "false") {
        return res.status(422).json({ error: "is_palindrome must be true or false" });
      }
      q["properties.is_palindrome"] = is_palindrome === "true";
    }

    if (min_length !== undefined) {
      const n = parseInt(min_length, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "min_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $gte: n });
    }

    if (max_length !== undefined) {
      const n = parseInt(max_length, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "max_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $lte: n });
    }

    if (word_count !== undefined) {
      const n = parseInt(word_count, 10);
      if (Number.isNaN(n)) return res.status(422).json({ error: "word_count must be integer" });
      q["properties.word_count"] = n;
    }

    if (contains_character !== undefined) {
      if (typeof contains_character !== "string" || contains_character.length !== 1) {
        return res.status(422).json({ error: "contains_character must be a single character" });
      }
      const ch = contains_character.toLowerCase();
      q[`properties.character_frequency_map.${ch}`] = { $exists: true, $gt: 0 };
    }

    const docs = await AnalyzedString.find(q).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      filters_applied: {
        ...(is_palindrome !== undefined ? { is_palindrome: is_palindrome === "true" } : {}),
        ...(min_length !== undefined ? { min_length: parseInt(min_length, 10) } : {}),
        ...(max_length !== undefined ? { max_length: parseInt(max_length, 10) } : {}),
        ...(word_count !== undefined ? { word_count: parseInt(word_count, 10) } : {}),
        ...(contains_character !== undefined ? { contains_character: contains_character.toLowerCase() } : {})
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/filter-by-natural-language?query=...
 * Uses nlParser to construct filters, then reuses getAllStrings-like behavior.
 */
async function filterByNaturalLanguage(req, res) {
  try {
    const q = req.query.query;
    if (!q) return res.status(422).json({ error: "query parameter is required" });

    let parsed;
    try {
      parsed = parseNaturalLanguage(q);
    } catch (err) {
      if (err.code === "UNPARSEABLE") {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // Now convert parsed to the same query used above
    const mongoQuery = {};

    if (parsed.is_palindrome !== undefined) mongoQuery["properties.is_palindrome"] = Boolean(parsed.is_palindrome);
    if (parsed.min_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $gte: parsed.min_length });
    if (parsed.max_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $lte: parsed.max_length });
    if (parsed.word_count !== undefined) mongoQuery["properties.word_count"] = parsed.word_count;
    if (parsed.contains_character !== undefined) {
      const ch = String(parsed.contains_character).toLowerCase();
      if (ch.length === 1) {
        mongoQuery[`properties.character_frequency_map.${ch}`] = { $exists: true, $gt: 0 };
      }
    }

    const docs = await AnalyzedString.find(mongoQuery).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      interpreted_query: {
        original: q,
        parsed_filters: parsed
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /strings/:string_value
 * Compute sha256 and remove by id
 */
async function deleteString(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined || raw === null) return res.status(422).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "String not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createString,
  getStringByValue,
  getAllStrings,
  filterByNaturalLanguage,
  deleteString
};
// ...existing code...const AnalyzedString = require("../models/stringModel");
const { analyze, sha256Hex } = require("../utils/analyzer");
const { parseNaturalLanguage } = require("../utils/nlParser");


async function createString(req, res) {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: '"value" field is required' });
    }
    if (typeof value !== "string") {
      return res.status(422).json({ error: '"value" must be a string' });
    }

    const properties = analyze(value);
    const id = properties.sha256_hash;

    // If record exists -> 409
    const existing = await AnalyzedString.findById(id).lean();
    if (existing) {
      return res.status(409).json({ error: "String already exists", id });
    }

    const doc = {
      _id: id,
      value,
      properties,
      created_at: new Date()
    };

    await AnalyzedString.create(doc);

    return res.status(201).json({
      id,
      value,
      properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/:string_value
 * We accept the path param as the raw string value.
 * We compute its SHA-256 and lookup by that id.
 */
async function getStringByValue(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined) return res.status(400).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "String not found" });

    return res.status(200).json({
      id: doc._id,
      value: doc.value,
      properties: doc.properties,
      created_at: doc.created_at.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings
 * Query params:
 *   is_palindrome (true/false)
 *   min_length (int)
 *   max_length (int)
 *   word_count (int)
 *   contains_character (single char)
 */
async function getAllStrings(req, res) {
  try {
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character
    } = req.query;

    // validate & build mongo query
    const q = {};

    if (is_palindrome !== undefined) {
      if (is_palindrome !== "true" && is_palindrome !== "false") {
        return res.status(400).json({ error: "is_palindrome must be true or false" });
      }
      q["properties.is_palindrome"] = is_palindrome === "true";
    }

    if (min_length !== undefined) {
      const n = parseInt(min_length, 10);
      if (Number.isNaN(n)) return res.status(400).json({ error: "min_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $gte: n });
    }

    if (max_length !== undefined) {
      const n = parseInt(max_length, 10);
      if (Number.isNaN(n)) return res.status(400).json({ error: "max_length must be integer" });
      q["properties.length"] = Object.assign(q["properties.length"] || {}, { $lte: n });
    }

    if (word_count !== undefined) {
      const n = parseInt(word_count, 10);
      if (Number.isNaN(n)) return res.status(400).json({ error: "word_count must be integer" });
      q["properties.word_count"] = n;
    }

    if (contains_character !== undefined) {
      if (contains_character.length !== 1) {
        return res.status(400).json({ error: "contains_character must be a single character" });
      }
      // check map key exists and >0
      q[`properties.character_frequency_map.${contains_character}`] = { $exists: true, $gt: 0 };
    }

    const docs = await AnalyzedString.find(q).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      filters_applied: {
        ...(is_palindrome !== undefined ? { is_palindrome } : {}),
        ...(min_length !== undefined ? { min_length: parseInt(min_length, 10) } : {}),
        ...(max_length !== undefined ? { max_length: parseInt(max_length, 10) } : {}),
        ...(word_count !== undefined ? { word_count: parseInt(word_count, 10) } : {}),
        ...(contains_character !== undefined ? { contains_character } : {})
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /strings/filter-by-natural-language?query=...
 * Uses nlParser to construct filters, then reuses getAllStrings-like behavior.
 */
async function filterByNaturalLanguage(req, res) {
  try {
    const q = req.query.query;
    if (!q) return res.status(400).json({ error: "query parameter is required" });

    let parsed;
    try {
      parsed = parseNaturalLanguage(q);
    } catch (err) {
      if (err.code === "UNPARSEABLE") {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // Now convert parsed to the same query used above
    const mongoQuery = {};

    if (parsed.is_palindrome !== undefined) mongoQuery["properties.is_palindrome"] = parsed.is_palindrome;
    if (parsed.min_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $gte: parsed.min_length });
    if (parsed.max_length !== undefined) mongoQuery["properties.length"] = Object.assign(mongoQuery["properties.length"] || {}, { $lte: parsed.max_length });
    if (parsed.word_count !== undefined) mongoQuery["properties.word_count"] = parsed.word_count;
    if (parsed.contains_character !== undefined) mongoQuery[`properties.character_frequency_map.${parsed.contains_character}`] = { $exists: true, $gt: 0 };

    const docs = await AnalyzedString.find(mongoQuery).sort({ created_at: -1 }).lean();
    const data = docs.map(d => ({
      id: d._id,
      value: d.value,
      properties: d.properties,
      created_at: d.created_at.toISOString()
    }));

    return res.status(200).json({
      data,
      count: data.length,
      interpreted_query: {
        original: q,
        parsed_filters: parsed
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /strings/:string_value
 * Compute sha256 and remove by id
 */
async function deleteString(req, res) {
  try {
    const raw = req.params.string_value;
    if (raw === undefined) return res.status(400).json({ error: "Missing path parameter" });
    const id = sha256Hex(raw);
    const doc = await AnalyzedString.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "String not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createString,
  getStringByValue,
  getAllStrings,
  filterByNaturalLanguage,
  deleteString
};
