const fs = require('fs');

let sql = fs.readFileSync('filess_import.sql', 'utf8');

// Parse out the PRIMARY KEY additions
const pkRegex = /ALTER TABLE `([a-zA-Z0-9_]+)`\n\s*ADD PRIMARY KEY \(`([a-zA-Z0-9_]+)`\)(.*?);/g;
let match;
const pks = {};
while ((match = pkRegex.exec(sql)) !== null) {
  pks[match[1]] = { pk: match[2], extra: match[3] || '' };
}

// Parse unique keys
const uniqueRegex = /ALTER TABLE `([a-zA-Z0-9_]+)`\n\s*ADD UNIQUE KEY `([a-zA-Z0-9_]+)` \(`([a-zA-Z0-9_]+)`\);/g;
const uniques = {};
while ((match = uniqueRegex.exec(sql)) !== null) {
  if (!uniques[match[1]]) uniques[match[1]] = [];
  uniques[match[1]].push({ name: match[2], column: match[3] });
}

// Parse AUTO_INCREMENT additions
const aiRegex = /ALTER TABLE `([a-zA-Z0-9_]+)`\n\s*MODIFY `([a-zA-Z0-9_]+)` int\(11\) NOT NULL AUTO_INCREMENT(, AUTO_INCREMENT=\d+)?;/g;
const ais = {};
while ((match = aiRegex.exec(sql)) !== null) {
  ais[match[1]] = { column: match[2], auto_increment: match[3] || '' };
}

// Fix CREATE TABLE statements
const createRegex = /CREATE TABLE `([a-zA-Z0-9_]+)` \(([\s\S]*?)\) ENGINE=InnoDB.*?;/g;

let fixedSql = sql;

fixedSql = fixedSql.replace(createRegex, (fullMatch, tableName, columns) => {
  let newColumns = columns;
  const tAi = ais[tableName];
  if (tAi) {
    // Replace the column row to add AUTO_INCREMENT
    const colRegex = new RegExp(`(\`${tAi.column}\` int\\(11\\) NOT NULL)`);
    newColumns = newColumns.replace(colRegex, `$1 AUTO_INCREMENT`);
  }
  
  const tPk = pks[tableName];
  if (tPk) {
    newColumns += `,\n  PRIMARY KEY (\`${tPk.pk}\`)`;
  }
  
  const tUniques = uniques[tableName];
  if (tUniques) {
    tUniques.forEach(u => {
      newColumns += `,\n  UNIQUE KEY \`${u.name}\` (\`${u.column}\`)`;
    });
  }

  // Also add AUTO_ID_CACHE = 1
  return `CREATE TABLE \`${tableName}\` (${newColumns}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;`;
});

// For addons, which was missing a PK in the dump
if (!fixedSql.includes("PRIMARY KEY (`addon_id`)") && fixedSql.includes("CREATE TABLE `addons`")) {
    fixedSql = fixedSql.replace("CREATE TABLE `addons` (\n  `addon_id` int(11) NOT NULL,", "CREATE TABLE `addons` (\n  `addon_id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,");
}

// Remove the indexes/auto_increment ALTER TABLE blocks (they are between "-- Indexes for dumped tables" and "-- Constraints for dumped tables")
// And the constraints
const parts = fixedSql.split('-- Indexes for dumped tables');
let cleanSql = parts[0];

if (parts[1]) {
    const constraintParts = parts[1].split('-- Constraints for dumped tables');
    if (constraintParts[1]) {
        // Keep constraints if needed, but let's just create them separately or not at all 
        // Actually, let's append constraints
        cleanSql += "\n-- Constraints for dumped tables\n" + constraintParts[1];
    }
}

fs.writeFileSync('tidb_import.sql', cleanSql);
console.log('Fixed SQL written to tidb_import.sql');
