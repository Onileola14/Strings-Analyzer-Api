# String Analyzer API

A RESTful API that analyzes strings and stores computed properties (length, palindrome, unique chars, SHA-256 id, character freq, etc.)

## Features
- POST /strings : analyze and store (409 if exists)
- GET /strings/:string_value : retrieve a specific string
- GET /strings : list all strings with query filters
- GET /strings/filter-by-natural-language?query=... : basic NLP-style filters
- DELETE /strings/:string_value : delete an entry

## Quick start
1. Clone repo
2. `npm install`
3. set .env with MONGO_URI
4. `npm start`

## Dependencies
- Node.js 
- express
- dotenv
- mongoose
- crypto
- http-status-codes
- express-async-errors
- helmet
- cors


## Notes about behavior
- Palindrome check: case-insensitive, ignores whitespace.
- `sha256_hash` used as id for deduplication.
- Natural language queries are heuristic and limited to supported phrases (see code `utils/nlParser.js`).

## Examples
(curl examples)
