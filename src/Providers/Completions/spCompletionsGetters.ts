import {
  CompletionItem,
  TextDocument,
  Position,
  CompletionList,
  CompletionItemKind,
} from "vscode";
import { basename } from "path";
import { URI } from "vscode-uri";

import { getTypeOfVariable } from "../../Backend/spItemsPropertyGetters";
import {
  getLastFunc,
  getLastEnumStructNameOrMethodMap,
} from "../../Providers/spDefinitionProvider";
import { SPItem } from "../../Backend/Items/spItems";
import { getAllPossibleIncludeFolderPaths } from "../../Backend/spFileHandlers";
import { ItemsRepository } from "../../Backend/spItemsRepository";
import { isMethodCall } from "../../Backend/spUtils";
import { getAllInheritances } from "../../Backend/spItemsPropertyGetters";
import { globalIdentifier } from "../../Misc/spConstants";
import { MethodMapItem } from "../../Backend/Items/spMethodmapItem";
import { EnumStructItem } from "../../Backend/Items/spEnumStructItem";
import { FunctionItem } from "../../Backend/Items/spFunctionItem";
import { MethodItem } from "../../Backend/Items/spMethodItem";

const MP = [CompletionItemKind.Method, CompletionItemKind.Property];

/**
 * Generate a CompletionList object of the possible includes file that can fit the already typed #include statement.
 * @param  {Set<string>} knownIncs    Set of parsed include files (.sp and .inc).
 * @param  {TextDocument} document    The document being edited.
 * @param  {string} tempName          The string that has already been typed in the #include statement.
 * @returns CompletionList
 */
export function getIncludeFileCompletionList(
  knownIncs: Set<string>,
  document: TextDocument,
  tempName: string,
  useAp: boolean
): CompletionList {
  const incURIs = getAllPossibleIncludeFolderPaths(document.uri).map((e) =>
    URI.file(e)
  );
  const prevPath = tempName.replace(/((?:[^\'\<\/]+\/)+)+/, "$1");

  let items: CompletionItem[] = [];

  Array.from(knownIncs).forEach((e) =>
    incURIs.find((incURI) => {
      const fileMatchRe = RegExp(
        `${incURI.toString()}\\/${prevPath}[^<>:;,?"*|/]+\\.(?:inc|sp)$`
      );
      if (fileMatchRe.test(e)) {
        const path = URI.parse(e).fsPath;
        items.push({
          label: basename(path, ".inc"),
          insertText: `${basename(path, ".inc")}${useAp ? '"' : ">"}`,
          kind: CompletionItemKind.File,
          detail: path,
        });
        return true;
      }
      return false;
    })
  );

  const availableIncFolderPaths = new Set<string>();
  knownIncs.forEach((e) => {
    incURIs.forEach((incURI) => {
      const folderMatchRe = RegExp(
        `${incURI.toString()}\\/${prevPath}(\\w[^*/><?\\|:]+)\\/`
      );
      const match = e.match(folderMatchRe);
      if (match) {
        availableIncFolderPaths.add(`${incURI.toString()}/${match[1]}`);
      }
    });
  });

  availableIncFolderPaths.forEach((e) => {
    const path = URI.parse(e).fsPath;
    items.push({
      label: basename(path),
      kind: CompletionItemKind.Folder,
      detail: path,
    });
  });

  return new CompletionList(items);
}

/**
 * Returns a CompletionList object of all the objects available at that position's scope.
 * @param  {ItemsRepository} itemsRepo    The itemsRepository object constructed in the activation event.
 * @param  {TextDocument} document        The document the completions are requested for.
 * @param  {Position} position            The position at which the completions are requested.
 * @returns CompletionList
 */
export function getCompletionListFromPosition(
  itemsRepo: ItemsRepository,
  document: TextDocument,
  position: Position
): CompletionList {
  const allItems: SPItem[] = itemsRepo.getAllItems(document.uri);
  if (allItems === []) {
    return new CompletionList();
  }

  const line = document.lineAt(position.line).text;
  const isMethod = isMethodCall(line, position);
  const lastFunc = getLastFunc(position, document, allItems);

  if (!isMethod) {
    return getNonMethodItems(allItems, lastFunc);
  }

  const lastEnumStructOrMethodMap = getLastEnumStructNameOrMethodMap(
    position,
    document.uri.fsPath,
    allItems
  );
  let { variableType, words } = getTypeOfVariable(
    line,
    position,
    allItems,
    lastFunc,
    lastEnumStructOrMethodMap
  );

  let variableTypeItem = allItems.find(
    (e) =>
      [CompletionItemKind.Class, CompletionItemKind.Struct].includes(e.kind) &&
      e.name === variableType
  ) as MethodMapItem | EnumStructItem;

  let variableTypes: (MethodMapItem | EnumStructItem)[];
  if (variableTypeItem.kind === CompletionItemKind.Class) {
    variableTypes = getAllInheritances(
      variableTypeItem as MethodMapItem,
      allItems
    );
  } else {
    variableTypes = [variableTypeItem as EnumStructItem];
  }

  const isMethodMap =
    words.length === 1 &&
    undefined !==
      allItems.find(
        (e) => e.name === words[0] && e.kind === CompletionItemKind.Class
      );

  return getMethodItems(allItems, variableTypes, isMethodMap, lastFunc);
}

function getMethodItems(
  allItems: SPItem[],
  variableTypes: (MethodMapItem | EnumStructItem)[],
  isMethodMap: boolean,
  lastFunc: MethodItem | FunctionItem
): CompletionList {
  let items = new Set<CompletionItem | undefined>();
  try {
    for (let item of allItems) {
      if (
        MP.includes(item.kind) &&
        variableTypes.includes(item.parent as EnumStructItem | MethodMapItem) &&
        // Don't include the constructor of the methodmap
        !variableTypes.includes(item as EnumStructItem | MethodMapItem) &&
        // Don't include static methods if we are not calling a method from its type.
        // This handles suggestions for 'Database.Connect()' for example.
        isMethodMap === /\bstatic\b[^\(]*\(/.test(item.detail as string)
      ) {
        items.add(item.toCompletionItem(lastFunc));
      }
    }
  } catch (e) {
    console.debug(e);
  }

  items.delete(undefined);
  return new CompletionList(
    Array.from(items).filter((e) => e !== undefined) as CompletionItem[]
  );
}

function getNonMethodItems(
  allItems: SPItem[],
  lastFunc: FunctionItem | MethodItem
): CompletionList {
  let items = new Set<CompletionItem | undefined>();

  for (let item of allItems) {
    if (!MP.includes(item.kind)) {
      items.add(item.toCompletionItem(lastFunc) as CompletionItem);
    }
  }

  items.delete(undefined);
  return new CompletionList(
    Array.from(items).filter((e) => e !== undefined) as CompletionItem[]
  );
}
