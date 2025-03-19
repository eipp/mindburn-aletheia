/**
 * Custom ESLint plugin to prevent duplication patterns
 * This plugin contains rules to detect and prevent common patterns that lead to code duplication
 */

module.exports = {
  rules: {
    // Detect files with Enhanced/Advanced/V2 in the name, which often indicate duplicated functionality
    'no-enhanced-files': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prevent files with Enhanced/Advanced in the name',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          noEnhancedFiles: 'Files with "{{ pattern }}" in the name are discouraged. Consider using a single implementation with configuration options instead.',
        },
        schema: [], // no options
      },
      create(context) {
        // Get the filename from the context
        const filename = context.getFilename();
        
        // Define the patterns to check for
        const badPatterns = [
          { regex: /Enhanced/i, name: 'Enhanced' },
          { regex: /Advanced/i, name: 'Advanced' },
          { regex: /V[0-9]+/i, name: 'version number (V1, V2, etc.)' },
          { regex: /Improved/i, name: 'Improved' },
          { regex: /New/i, name: 'New' },
        ];
        
        // Check each pattern
        for (const pattern of badPatterns) {
          if (pattern.regex.test(filename)) {
            // Report the issue on the first token of the file
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'noEnhancedFiles',
              data: {
                pattern: pattern.name
              }
            });
            
            // Only report one matching pattern per file
            break;
          }
        }
        
        return {};
      }
    }
  }
}; 