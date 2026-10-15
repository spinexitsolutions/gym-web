import mongoose from 'mongoose';

// Each test file re-evaluates src/models while the mongoose module instance is shared,
// so clear previously compiled models before the file's imports register them again.
mongoose.deleteModel(/.+/);
