﻿import { positiveRange } from "./utils";
import { Parser } from "./spParser";
import { DefineItem } from "../Backend/Items/spDefineItem";

export function readDefine(
  parser: Parser,
  match: RegExpMatchArray,
  line: string
): void {
  let description = "";
  let value = "";
  let openDQuote = false;
  let openSQuote = false;
  let blockComment = false;
  let i = match[0].length;
  let iter = 0;
  while (i < line.length && iter < 10000) {
    iter++;
    if (line[i] === '"' && !openSQuote && !blockComment) {
      openDQuote = !openDQuote;
      value += line[i];
      i++;
      continue;
    }
    if (line[i] === "'" && !openDQuote && !blockComment) {
      openSQuote = !openSQuote;
      value += line[i];
      i++;
      continue;
    }

    if (!blockComment) {
      if (i < line.length - 1) {
        if (
          line[i] === "/" &&
          line[i + 1] === "*" &&
          !(openSQuote || openDQuote)
        ) {
          blockComment = true;
          i += 2;
          continue;
        } else if (
          line[i] === "/" &&
          line[i + 1] === "/" &&
          !(openSQuote || openDQuote)
        ) {
          description = line.slice(i + 2);
          break;
        }
      }
      value += line[i];
      i++;
    } else {
      let endComMatch = line.slice(i).match(/(.*)\*\//);
      if (endComMatch) {
        description += line.slice(i, i + endComMatch[1].length).trimEnd();
        blockComment = false;
        i += endComMatch[0].length;
        continue;
      }
      description += line.slice(i).trimEnd();
      line = parser.lines.shift();
      parser.lineNb++;
      if (line === undefined) {
        return;
      }
      i = 0;
      continue;
    }
  }

  let range = parser.makeDefinitionRange(match[1], line);
  let fullRange = positiveRange(parser.lineNb, 0, line.length);
  let item = new DefineItem(
    match[1],
    value,
    description,
    parser.filePath,
    range,
    parser.IsBuiltIn,
    fullRange
  );
  parser.fileItems.set(match[1], item);
  return;
}
