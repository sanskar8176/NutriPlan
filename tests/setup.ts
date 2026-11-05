// Global test setup. Keep env deterministic so provider selection and
// rate-limit keys do not depend on the developer's .env.local.
process.env.NODE_ENV = "test";
delete process.env.LOCAL_MODEL_BASE_URL;
delete process.env.LOCAL_MODEL_NAME;
delete process.env.GEMINI_API_KEY;
delete process.env.UNSPLASH_ACCESS_KEY;
