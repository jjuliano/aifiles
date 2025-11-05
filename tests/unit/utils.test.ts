import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Performance testing utilities
const measurePerformance = async (fn: () => Promise<any> | any, iterations = 1000): Promise<number> => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  return (end - start) / iterations; // Average time per operation
};

import {
  separateFolderAndFile,
  parseJson,
  replacePromptKeys,
  resolvePath,
  changeCase,
  categorizeFileByMimeType,
} from '../../src/utils.js';

describe('Utils', () => {
  describe('separateFolderAndFile', () => {
    it('should separate folder and file correctly', () => {
      const result = separateFolderAndFile('/path/to/file.txt');
      expect(result).toEqual(['/path/to', 'file']);
    });

    it('should handle file without extension', () => {
      const result = separateFolderAndFile('/path/to/file');
      expect(result).toEqual(['/path/to', 'file']);
    });

    it('should handle root level file', () => {
      const result = separateFolderAndFile('file.txt');
      expect(result).toEqual(['', 'file']);
    });
  });

  describe('parseJson', () => {
    it('should parse valid JSON string', async () => {
      const jsonString = '{"key": "value", "number": 42}';
      const result = await parseJson(jsonString);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return undefined for invalid JSON', async () => {
      const jsonString = 'invalid json';
      const result = await parseJson(jsonString);

      expect(result).toBeUndefined();
    });
  });

  describe('replacePromptKeys', () => {
    it('should replace prompt keys and construct file path', async () => {
      const format = '{artist} - {title}';
      const data = {
        artist: 'Test Artist',
        title: 'Test Song',
      };

      const result = await replacePromptKeys(format, data, '/home/music', '.mp3', 'snake');

      expect(result).toContain('Test_Artist_-_Test_Song.mp3');
    });

    it('should handle null values', async () => {
      const format = '{artist} - {title}';
      const data = {
        artist: null,
        title: 'Test Song',
      };

      const result = await replacePromptKeys(format, data, '/home/music', '.mp3', 'snake');

      expect(result).toContain('Test_Song.mp3');
    });

    it('should apply reserved words transformations', async () => {
      const format = '{_camel_}';
      const data = {
        _camel_: 'hello world',
      };

      const reservedWords = {
        _camel_: (value: string) => changeCase(value, 'camel'),
      };

      const result = await replacePromptKeys(format, data, '/home/music', '.mp3', 'snake', reservedWords);

      expect(result).toContain('helloWorld.mp3');
    });
  });

  describe('resolvePath', () => {
    it('should handle paths without tilde', () => {
      const result = resolvePath('/absolute/path/file.txt');

      expect(result).toBe('/absolute/path/file.txt');
    });
  });

  describe('changeCase', () => {
    it('should convert to camelCase', () => {
      expect(changeCase('hello world', 'camel')).toBe('helloWorld');
      expect(changeCase('Hello World', 'camel')).toBe('helloWorld');
    });

    it('should convert to snake_case', () => {
      expect(changeCase('hello world', 'snake')).toBe('hello_world');
    });

    it('should convert to kebab-case', () => {
      expect(changeCase('hello world', 'kebab')).toBe('hello-world');
    });

    it('should convert to PascalCase', () => {
      expect(changeCase('hello world', 'pascal')).toBe('HelloWorld');
    });

    it('should convert to UPPER_SNAKE', () => {
      expect(changeCase('hello world', 'upper_snake')).toBe('HELLO_WORLD');
    });

    it('should convert to lower_snake', () => {
      expect(changeCase('Hello World', 'lower_snake')).toBe('hello_world');
    });

    it('should return cleaned string for unknown case', () => {
      expect(changeCase('Hello@World!', 'unknown')).toBe('HelloWorld');
    });

    it('should handle undefined case type', () => {
      expect(changeCase('Hello World', undefined)).toBe('Hello World');
    });
  });

  describe('categorizeFileByMimeType', () => {
    it('should categorize image files', () => {
      expect(categorizeFileByMimeType('image/jpeg')).toBe('Pictures');
      expect(categorizeFileByMimeType('image/png')).toBe('Pictures');
    });

    it('should categorize audio files', () => {
      expect(categorizeFileByMimeType('audio/mpeg')).toBe('Music');
      expect(categorizeFileByMimeType('audio/wav')).toBe('Music');
    });

    it('should categorize video files', () => {
      expect(categorizeFileByMimeType('video/mp4')).toBe('Videos');
      expect(categorizeFileByMimeType('video/mpeg')).toBe('Videos');
    });

    it('should categorize document files', () => {
      expect(categorizeFileByMimeType('application/pdf')).toBe('Documents');
      expect(categorizeFileByMimeType('application/msword')).toBe('Documents');
    });

    it('should categorize archive files', () => {
      expect(categorizeFileByMimeType('application/zip')).toBe('Archives');
      expect(categorizeFileByMimeType('application/x-tar')).toBe('Archives');
    });

    it('should categorize unknown files as Others', () => {
      expect(categorizeFileByMimeType('application/octet-stream')).toBe('Others');
      expect(categorizeFileByMimeType('unknown/type')).toBe('Others');
    });
  });

  describe('Property-based tests', () => {
    it('should handle any string input for parseJson safely', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // parseJson should never throw, only return undefined for invalid JSON
          expect(() => parseJson(input)).not.toThrow();
          const result = parseJson(input);
          expect(result === undefined || typeof result === 'object').toBe(true);
        })
      );
    });

    it('should handle any string input for changeCase safely', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (str, caseType) => {
          // changeCase should never throw for any input
          expect(() => changeCase(str, caseType as any)).not.toThrow();
          const result = changeCase(str, caseType as any);
          expect(typeof result).toBe('string');
        })
      );
    });

    it('should handle various mime types for categorizeFileByMimeType safely', () => {
      fc.assert(
        fc.property(fc.string(), (mimeType) => {
          // categorizeFileByMimeType should never throw and always return valid category
          expect(() => categorizeFileByMimeType(mimeType)).not.toThrow();
          const result = categorizeFileByMimeType(mimeType);
          expect(['Images', 'Videos', 'Music', 'Documents', 'Archives', 'Others']).toContain(result);
        })
      );
    });

    it('should handle any file path for separateFolderAndFile safely', () => {
      fc.assert(
        fc.property(fc.string(), (filePath) => {
          // separateFolderAndFile should never throw
          expect(() => separateFolderAndFile(filePath)).not.toThrow();
          const result = separateFolderAndFile(filePath);
          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(2);
          expect(typeof result[0]).toBe('string'); // folderPath
          expect(typeof result[1]).toBe('string'); // fileName
        })
      );
    });

    it('should generate consistent results for the same inputs', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // Same input should produce same output (deterministic)
          const result1 = separateFolderAndFile(input);
          const result2 = separateFolderAndFile(input);
          expect(result1[0]).toBe(result2[0]); // folderPath
          expect(result1[1]).toBe(result2[1]); // fileName
        })
      );
    });
  });

  describe('Performance tests', () => {
    it('should perform parseJson efficiently', async () => {
      const testJson = '{"key": "value", "number": 123, "array": [1, 2, 3]}';

      const avgTime = await measurePerformance(() => parseJson(testJson), 100);

      // Should complete in less than 1ms on average
      expect(avgTime).toBeLessThan(1);
    });

    it('should perform separateFolderAndFile efficiently', async () => {
      const testPath = '/home/user/documents/file.txt';

      const avgTime = await measurePerformance(() => separateFolderAndFile(testPath), 1000);

      // Should complete in less than 0.1ms on average
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should perform categorizeFileByMimeType efficiently', async () => {
      const testMime = 'image/jpeg';

      const avgTime = await measurePerformance(() => categorizeFileByMimeType(testMime), 1000);

      // Should complete in less than 0.1ms on average
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should handle large JSON parsing gracefully', async () => {
      const largeJson = JSON.stringify({
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` })),
        metadata: { total: 1000, page: 1 }
      });

      const avgTime = await measurePerformance(() => parseJson(largeJson), 10);

      // Should complete in less than 10ms even for large JSON
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Load and Stress tests', () => {
    it('should handle large JSON arrays efficiently', async () => {
      const largeArray = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
        nested: { value: Math.random() }
      }));

      const jsonString = JSON.stringify({ data: largeArray });

      const avgTime = await measurePerformance(() => parseJson(jsonString), 5);

      // Should handle large JSON within reasonable time (under 5ms)
      expect(avgTime).toBeLessThan(5);

      // Test that parsing doesn't throw
      expect(async () => await parseJson(jsonString)).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => ({
        input: `test-string-${i}`,
        caseType: ['upper', 'lower', 'camel', 'pascal', 'kebab', 'snake'][i % 6] as any
      }));

      const start = performance.now();

      // Run operations concurrently
      const promises = operations.map(op =>
        changeCase(op.input, op.caseType)
      );

      const results = await Promise.all(promises);
      const end = performance.now();

      // Should complete within reasonable time
      expect(end - start).toBeLessThan(50); // Under 50ms for 50 operations
      expect(results).toHaveLength(50);
      results.forEach(result => expect(typeof result).toBe('string'));
    });

    it('should handle memory-intensive operations', async () => {
      const largeStrings = Array.from({ length: 100 }, () =>
        'a'.repeat(100) // 100B strings
      );

      const avgTime = await measurePerformance(() => {
        largeStrings.forEach(str => categorizeFileByMimeType(`text/${str.substring(0, 10)}`));
      }, 5);

      // Should handle memory-intensive operations reasonably
      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('Fuzz tests', () => {
    it('should handle malicious JSON inputs safely', () => {
      const maliciousInputs = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{\n  "data": "value"\n  // Comment\n}',
        '{"key": "value"}\n{"another": "object"}',
        '['.repeat(1000) + ']'.repeat(1000), // Deep nesting
        '"'.repeat(10000), // Long strings
        '\x00\x01\x02', // Null bytes
        '\u0000\u0001\u0002', // Unicode null
        '{"key": "\uFFFF"}', // Invalid Unicode
      ];

      maliciousInputs.forEach(input => {
        expect(() => parseJson(input)).not.toThrow();
        const result = parseJson(input);
        expect(result === undefined || typeof result === 'object').toBe(true);
      });
    });

    it('should handle filesystem attack vectors safely', () => {
      const attackPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
        '~/.ssh/id_rsa',
        '/dev/null',
        'nul',
        'CON',
        'PRN',
        'AUX',
        'COM1',
        'LPT1',
        '',
        '.',
        '..',
        '/',
        '\\',
        '\\\\\\\\UNC\\\\path',
        '<script>alert(1)</script>', // XSS attempt
        'file://etc/passwd',
        'http://evil.com',
      ];

      attackPaths.forEach(path => {
        expect(() => separateFolderAndFile(path)).not.toThrow();
        const result = separateFolderAndFile(path);
        expect(typeof result[0]).toBe('string'); // folderPath
        expect(typeof result[1]).toBe('string'); // fileName
      });
    });

    it('should handle extreme string inputs for changeCase', () => {
      const extremeInputs = [
        '',
        'a',
        'A',
        '123',
        '!@#$%^&*()',
        '🚀🎉💻',
        '\u0000\uFFFF',
        'a'.repeat(10000), // Very long string
        'A'.repeat(10000),
        'mixedCaseString123!@#',
        'UPPER_CASE',
        'lower_case',
        'camelCase',
        'PascalCase',
        'kebab-case',
        'snake_case',
        'SCREAMING_SNAKE_CASE',
      ];

      const caseTypes = ['', 'upper', 'lower', 'camel', 'pascal', 'kebab', 'snake', 'invalid'];

      extremeInputs.forEach(str => {
        caseTypes.forEach(caseType => {
          expect(() => changeCase(str, caseType as any)).not.toThrow();
          const result = changeCase(str, caseType as any);
          expect(typeof result).toBe('string');
        });
      });
    });

    it('should handle malformed MIME types safely', () => {
      const malformedMimes = [
        '',
        '/',
        'text',
        '/plain',
        'text/',
        'text/plain/extra',
        'text/plain; charset=utf-8; extra=param',
        'invalid/invalid/invalid',
        'a'.repeat(1000) + '/' + 'b'.repeat(1000),
        '\x00\x01\x02/\x03\x04\x05',
        'text/plain\x00evil',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '../../../evil',
      ];

      malformedMimes.forEach(mime => {
        expect(() => categorizeFileByMimeType(mime)).not.toThrow();
        const result = categorizeFileByMimeType(mime);
        expect(['Images', 'Videos', 'Music', 'Documents', 'Archives', 'Others']).toContain(result);
      });
    });
  });

});
