﻿import {
  TextDocument,
  Range,
  Position,
  CompletionItemKind,
  CancellationToken,
  LocationLink,
} from "vscode";
import { URI } from "vscode-uri";

import { SPItem } from "../Backend/Items/spItems";
import { ItemsRepository } from "../Backend/spItemsRepository";
import { MethodItem } from "../Backend/Items/spMethodItem";
import { FunctionItem } from "../Backend/Items/spFunctionItem";
import { EnumStructItem } from "../Backend/Items/spEnumStructItem";
import { MethodMapItem } from "../Backend/Items/spMethodmapItem";

export function getLastFunc(
  position: Position,
  document: TextDocument,
  allItems: SPItem[]
): FunctionItem | MethodItem | undefined {
  return allItems.find(
    (e) =>
      [CompletionItemKind.Function, CompletionItemKind.Method].includes(
        e.kind
      ) &&
      e.filePath === document.uri.fsPath &&
      e.fullRange.contains(position)
  ) as FunctionItem | MethodItem;
}

export function isInAComment(
  range: Range,
  uri: URI,
  allItems: SPItem[]
): boolean {
  let file = uri.fsPath;
  let item = allItems.find(
    (e) =>
      e.kind === CompletionItemKind.User &&
      e.filePath == file &&
      e.range.contains(range)
  );
  return item !== undefined;
}

export function isInAString(range: Range, line: string): boolean {
  let i = 0;
  let isEscaped = false;
  let end = range.end.character;
  let isAString = false;
  let delimiter: string | undefined;
  for (i = 0; i < line.length && i < end; i++) {
    if (line[i] === "'" && !isEscaped) {
      if (delimiter === "'") {
        isAString = false;
        delimiter = undefined;
      } else if (delimiter === undefined) {
        isAString = true;
        delimiter = "'";
      }
    } else if (line[i] === '"' && !isEscaped) {
      if (delimiter === '"') {
        isAString = false;
        delimiter = undefined;
      } else if (delimiter === undefined) {
        isAString = true;
        delimiter = '"';
      }
    } else if (line[i] === "\\") {
      isEscaped = true;
      continue;
    }
    isEscaped = false;
  }
  return isAString;
}

export function isFunction(
  range: Range,
  document: TextDocument,
  lineLength: number
): boolean {
  let start = new Position(range.start.line, range.end.character);
  let end = new Position(range.end.line, lineLength + 1);
  let rangeAfter = new Range(start, end);
  let rangeBefore = new Range(
    range.start.line,
    0,
    range.start.line,
    range.end.character
  );
  let wordsAfter: string = document.getText(rangeAfter);
  let wordsBefore: string = document.getText(rangeBefore);
  return /^\s*\(/.test(wordsAfter) && !/function\s+\w+$/.test(wordsBefore);
}

export function isControlStatement(line: string): boolean {
  let toCheck: RegExp[] = [
    /\s*\bif\b/,
    /\s*\bfor\b/,
    /\s*\bwhile\b/,
    /\s*\bcase\b/,
    /\s*\bswitch\b/,
    /\s*\breturn\b/,
  ];
  for (let re of toCheck) {
    if (re.test(line)) {
      return true;
    }
  }
  return false;
}

export function getLastEnumStructNameOrMethodMap(
  position: Position,
  filePath: string,
  allItems: SPItem[]
): EnumStructItem | MethodMapItem | undefined {
  return allItems.find(
    (e) =>
      [CompletionItemKind.Struct, CompletionItemKind.Class].includes(e.kind) &&
      e.filePath === filePath &&
      e.fullRange != undefined &&
      e.fullRange.contains(position)
  ) as EnumStructItem | MethodMapItem | undefined;
}

export function definitionsProvider(
  itemsRepo: ItemsRepository,
  document: TextDocument,
  position: Position,
  token: CancellationToken
): LocationLink[] {
  const items = itemsRepo.getItemFromPosition(document, position);
  if (items.length > 0) {
    return items
      .map((e) => e.toDefinitionItem())
      .filter((e) => e !== undefined);
  }
  return [];
}
