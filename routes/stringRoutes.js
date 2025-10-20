const express = require("express");
const router = express.Router();
const {
  createString,
  getStringByValue,
  getAllStrings,
  filterByNaturalLanguage,
  deleteString
} = require("../controller/stringController");

router.post("/", createString);
router.get("/", getAllStrings);
router.get("/filter-by-natural-language", filterByNaturalLanguage);
router.get("/:string_value", getStringByValue);
router.delete("/:string_value", deleteString);

module.exports = router;
