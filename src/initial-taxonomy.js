export const INITIAL_TAXONOMY = Object.freeze({
  subjects: Object.freeze([
    "Agriculture and Food Systems",
    "Anthropology",
    "Arts and Design",
    "Astronomy and Cosmology",
    "Biology",
    "Business and Management",
    "Chemistry",
    "Cognitive Science",
    "Communication and Media",
    "Computer Science",
    "Earth Science",
    "Economics",
    "Education and Learning",
    "Engineering",
    "Environmental Science",
    "Finance and Accounting",
    "Geography",
    "History",
    "Information Science",
    "Language and Linguistics",
    "Law and Legal Systems",
    "Literature",
    "Logic and Formal Reasoning",
    "Mathematics",
    "Medicine and Health",
    "Music",
    "Neuroscience",
    "Physics",
    "Political Science",
    "Psychology",
    "Sociology",
    "Statistics and Data Science",
    "Technology"
  ]),
  ideologies: Object.freeze([
    "Aesthetics",
    "Economic Thought",
    "Environment and Nature",
    "Epistemology",
    "Ethics",
    "Existence and Meaning",
    "Language and Meaning",
    "Law and Justice",
    "Metaphysics",
    "Mind and Consciousness",
    "Personal Worldview",
    "Politics",
    "Reason and Argumentation",
    "Religion and Spirituality",
    "Science and Knowledge",
    "Society and Culture",
    "Technology and Humanity"
  ])
});

const SEED_KEY = "initial_taxonomy_v1";

export function seedInitialTaxonomy(database) {
  if (database.prepare("SELECT 1 FROM app_metadata WHERE key = ?").get(SEED_KEY)) return false;

  const timestamp = new Date().toISOString();
  const insertNode = database.prepare(`
    INSERT OR IGNORE INTO nodes (
      name, branch, parent_id, status, understanding, revision, created_at, updated_at
    ) VALUES (?, ?, NULL, 'unassessed', NULL, 1, ?, ?)
  `);

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const [branch, names] of Object.entries(INITIAL_TAXONOMY)) {
      for (const name of names) insertNode.run(name, branch, timestamp, timestamp);
    }
    database.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
      .run(SEED_KEY, timestamp);
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
