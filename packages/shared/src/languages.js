// File extension -> editor language + Piston runtime.
// `monaco` is the Monaco language id used for syntax highlighting.
// `piston` is the Piston language name (or alias) used to run the file;
// null means the file type cannot be executed.
export const LANGUAGES = [
  { ext: 'js', label: 'JavaScript', monaco: 'javascript', piston: 'javascript', hello: 'console.log("Hello, CodeSynq!");\n' },
  { ext: 'ts', label: 'TypeScript', monaco: 'typescript', piston: 'typescript', hello: 'const greeting: string = "Hello, CodeSynq!";\nconsole.log(greeting);\n' },
  { ext: 'py', label: 'Python', monaco: 'python', piston: 'python', hello: 'print("Hello, CodeSynq!")\n' },
  { ext: 'java', label: 'Java', monaco: 'java', piston: 'java', hello: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeSynq!");\n    }\n}\n' },
  { ext: 'c', label: 'C', monaco: 'c', piston: 'c', hello: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, CodeSynq!\\n");\n    return 0;\n}\n' },
  { ext: 'cpp', label: 'C++', monaco: 'cpp', piston: 'c++', hello: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, CodeSynq!" << std::endl;\n    return 0;\n}\n' },
  { ext: 'cs', label: 'C#', monaco: 'csharp', piston: 'csharp', hello: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, CodeSynq!");\n    }\n}\n' },
  { ext: 'go', label: 'Go', monaco: 'go', piston: 'go', hello: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, CodeSynq!")\n}\n' },
  { ext: 'rs', label: 'Rust', monaco: 'rust', piston: 'rust', hello: 'fn main() {\n    println!("Hello, CodeSynq!");\n}\n' },
  { ext: 'rb', label: 'Ruby', monaco: 'ruby', piston: 'ruby', hello: 'puts "Hello, CodeSynq!"\n' },
  { ext: 'php', label: 'PHP', monaco: 'php', piston: 'php', hello: '<?php\necho "Hello, CodeSynq!\\n";\n' },
  { ext: 'swift', label: 'Swift', monaco: 'swift', piston: 'swift', hello: 'print("Hello, CodeSynq!")\n' },
  { ext: 'kt', label: 'Kotlin', monaco: 'kotlin', piston: 'kotlin', hello: 'fun main() {\n    println("Hello, CodeSynq!")\n}\n' },
  { ext: 'scala', label: 'Scala', monaco: 'scala', piston: 'scala', hello: 'object Main extends App {\n  println("Hello, CodeSynq!")\n}\n' },
  { ext: 'r', label: 'R', monaco: 'r', piston: 'rscript', hello: 'cat("Hello, CodeSynq!\\n")\n' },
  { ext: 'pl', label: 'Perl', monaco: 'perl', piston: 'perl', hello: 'print "Hello, CodeSynq!\\n";\n' },
  { ext: 'lua', label: 'Lua', monaco: 'lua', piston: 'lua', hello: 'print("Hello, CodeSynq!")\n' },
  { ext: 'hs', label: 'Haskell', monaco: 'plaintext', piston: 'haskell', hello: 'main :: IO ()\nmain = putStrLn "Hello, CodeSynq!"\n' },
  { ext: 'sh', label: 'Bash', monaco: 'shell', piston: 'bash', hello: 'echo "Hello, CodeSynq!"\n' },
  { ext: 'ps1', label: 'PowerShell', monaco: 'powershell', piston: 'powershell', hello: 'Write-Output "Hello, CodeSynq!"\n' },
  { ext: 'dart', label: 'Dart', monaco: 'dart', piston: 'dart', hello: 'void main() {\n  print("Hello, CodeSynq!");\n}\n' },
  { ext: 'ex', label: 'Elixir', monaco: 'elixir', piston: 'elixir', hello: 'IO.puts "Hello, CodeSynq!"\n' },
  { ext: 'exs', label: 'Elixir', monaco: 'elixir', piston: 'elixir', hello: 'IO.puts "Hello, CodeSynq!"\n' },
  { ext: 'erl', label: 'Erlang', monaco: 'plaintext', piston: 'erlang', hello: '-module(main).\n-export([main/1]).\n\nmain(_) ->\n    io:format("Hello, CodeSynq!~n").\n' },
  { ext: 'clj', label: 'Clojure', monaco: 'clojure', piston: 'clojure', hello: '(println "Hello, CodeSynq!")\n' },
  { ext: 'fs', label: 'F#', monaco: 'fsharp', piston: 'fsharp', hello: 'printfn "Hello, CodeSynq!"\n' },
  { ext: 'jl', label: 'Julia', monaco: 'julia', piston: 'julia', hello: 'println("Hello, CodeSynq!")\n' },
  { ext: 'nim', label: 'Nim', monaco: 'plaintext', piston: 'nim', hello: 'echo "Hello, CodeSynq!"\n' },
  { ext: 'cr', label: 'Crystal', monaco: 'plaintext', piston: 'crystal', hello: 'puts "Hello, CodeSynq!"\n' },
  { ext: 'd', label: 'D', monaco: 'plaintext', piston: 'd', hello: 'import std.stdio;\n\nvoid main() {\n    writeln("Hello, CodeSynq!");\n}\n' },
  { ext: 'zig', label: 'Zig', monaco: 'plaintext', piston: 'zig', hello: 'const std = @import("std");\n\npub fn main() void {\n    std.debug.print("Hello, CodeSynq!\\n", .{});\n}\n' },
  { ext: 'pas', label: 'Pascal', monaco: 'pascal', piston: 'pascal', hello: 'program Hello;\nbegin\n  writeln(\'Hello, CodeSynq!\');\nend.\n' },
  { ext: 'f90', label: 'Fortran', monaco: 'plaintext', piston: 'fortran', hello: 'program hello\n  print *, "Hello, CodeSynq!"\nend program hello\n' },
  { ext: 'cob', label: 'COBOL', monaco: 'plaintext', piston: 'cobol', hello: '       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO.\n       PROCEDURE DIVISION.\n           DISPLAY "Hello, CodeSynq!".\n           STOP RUN.\n' },
  { ext: 'groovy', label: 'Groovy', monaco: 'plaintext', piston: 'groovy', hello: 'println "Hello, CodeSynq!"\n' },
  { ext: 'ml', label: 'OCaml', monaco: 'plaintext', piston: 'ocaml', hello: 'print_endline "Hello, CodeSynq!"\n' },
  { ext: 'lisp', label: 'Common Lisp', monaco: 'plaintext', piston: 'lisp', hello: '(format t "Hello, CodeSynq!~%")\n' },
  { ext: 'rkt', label: 'Racket', monaco: 'scheme', piston: 'racket', hello: '#lang racket\n(displayln "Hello, CodeSynq!")\n' },
  { ext: 'scm', label: 'Scheme', monaco: 'scheme', piston: 'scheme', hello: '(display "Hello, CodeSynq!")\n(newline)\n' },
  { ext: 'asm', label: 'NASM', monaco: 'plaintext', piston: 'nasm', hello: '' },
  { ext: 'sql', label: 'SQLite', monaco: 'sql', piston: 'sqlite3', hello: "SELECT 'Hello, CodeSynq!';\n" },
  { ext: 'coffee', label: 'CoffeeScript', monaco: 'coffeescript', piston: 'coffeescript', hello: 'console.log "Hello, CodeSynq!"\n' },
  { ext: 'm', label: 'Octave', monaco: 'plaintext', piston: 'octave', hello: 'disp("Hello, CodeSynq!")\n' },
  { ext: 'pro', label: 'Prolog', monaco: 'plaintext', piston: 'prolog', hello: ':- initialization(main).\nmain :- write(\'Hello, CodeSynq!\'), nl, halt.\n' },
  { ext: 'raku', label: 'Raku', monaco: 'plaintext', piston: 'raku', hello: 'say "Hello, CodeSynq!";\n' },
  { ext: 'v', label: 'V', monaco: 'plaintext', piston: 'vlang', hello: 'fn main() {\n\tprintln("Hello, CodeSynq!")\n}\n' },
  { ext: 'bas', label: 'FreeBASIC', monaco: 'plaintext', piston: 'basic', hello: 'Print "Hello, CodeSynq!"\n' },
  { ext: 'bf', label: 'Brainfuck', monaco: 'plaintext', piston: 'brainfuck', hello: '' },

  // Editable but not executable.
  { ext: 'md', label: 'Markdown', monaco: 'markdown', piston: null, hello: '' },
  { ext: 'json', label: 'JSON', monaco: 'json', piston: null, hello: '' },
  { ext: 'html', label: 'HTML', monaco: 'html', piston: null, hello: '' },
  { ext: 'css', label: 'CSS', monaco: 'css', piston: null, hello: '' },
  { ext: 'yaml', label: 'YAML', monaco: 'yaml', piston: null, hello: '' },
  { ext: 'yml', label: 'YAML', monaco: 'yaml', piston: null, hello: '' },
  { ext: 'xml', label: 'XML', monaco: 'xml', piston: null, hello: '' },
  { ext: 'txt', label: 'Plain text', monaco: 'plaintext', piston: null, hello: '' },
];

const PLAIN_TEXT = { ext: '', label: 'Plain text', monaco: 'plaintext', piston: null, hello: '' };
const BY_EXT = new Map(LANGUAGES.map((l) => [l.ext, l]));

export function languageForFile(name) {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return PLAIN_TEXT;
  return BY_EXT.get(name.slice(dot + 1).toLowerCase()) ?? PLAIN_TEXT;
}

export const RUNNABLE_LANGUAGE_COUNT = new Set(LANGUAGES.filter((l) => l.piston).map((l) => l.piston)).size;

const FILE_NAME = /^[\w\-. ]{1,64}$/;

export function validateFileName(name) {
  if (typeof name !== 'string') return 'File name is required';
  const trimmed = name.trim();
  if (!FILE_NAME.test(trimmed)) return 'Use 1-64 letters, digits, spaces, dots, dashes or underscores';
  if (trimmed === '.' || trimmed === '..') return 'Invalid file name';
  return null;
}
