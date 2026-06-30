import { test, expect } from "bun:test";
import { parseReel } from "../src/parse.ts";

test("parses metadata and beats", () => {
  const s = parseReel(`
# a demo
name: my-demo
title: My Demo
subtitle: narrated terminal demo
voice: Charon

run: echo "hello world"
say: First, a greeting.
caption: echo writes to stdout
hold: 3

run: ls -la
say: Then we list the directory.
`);
  expect(s.name).toBe("my-demo");
  expect(s.title).toBe("My Demo");
  expect(s.voice).toBe("Charon");
  expect(s.steps).toHaveLength(2);
  expect(s.steps[0]).toEqual({ run: 'echo "hello world"', say: "First, a greeting.", caption: "echo writes to stdout", hold: 3 });
  expect(s.steps[1].run).toBe("ls -la");
});

test("coerces numeric and boolean metadata", () => {
  const s = parseReel("name: x\nfontSize: 40\nreplay: false\nrun: pwd\n");
  expect(s.fontSize).toBe(40);
  expect(s.replay).toBe(false);
});

test("continuation lines append to the previous value", () => {
  const s = parseReel(`name: x
run: pwd
say: This is a long
  narration that spans
  three lines.
`);
  expect(s.steps[0].say).toBe("This is a long narration that spans three lines.");
});

test("requires a name", () => {
  expect(() => parseReel("run: pwd\n")).toThrow(/missing required "name:"/);
});

test("requires at least one beat", () => {
  expect(() => parseReel("name: x\n")).toThrow(/at least one/);
});

test("rejects a step key before any run", () => {
  expect(() => parseReel("name: x\nsay: hi\n")).toThrow(/before any "run:"/);
});

test("rejects unknown keys", () => {
  expect(() => parseReel("name: x\nbogus: 1\nrun: pwd\n")).toThrow(/unknown key/);
});

test("rejects empty run", () => {
  expect(() => parseReel("name: x\nrun:\n")).toThrow(/empty "run:"/);
});

test("metadata may appear after beats (outro at the end reads naturally)", () => {
  const s = parseReel("name: x\nrun: pwd\nsay: here\noutro: Bye\noutroSay: Thanks.\n");
  expect(s.outro).toBe("Bye");
  expect(s.outroSay).toBe("Thanks.");
  expect(s.steps[0].say).toBe("here");
});

test("keeps colons inside values", () => {
  const s = parseReel('name: x\nrun: git commit -m "fix: thing"\n');
  expect(s.steps[0].run).toBe('git commit -m "fix: thing"');
});
