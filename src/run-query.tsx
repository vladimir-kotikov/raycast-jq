import { Action, ActionPanel, Clipboard, List, showToast, Toast } from "@raycast/api";
import { useCachedPromise, useExec, usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { ensureJq, JQ_EXEC } from "./jq";

// TODO: See how details are implemented in the Multitranslator extension

const getDetailsContent = (
  isLoading: boolean,
  documentError: Error | undefined,
  jsonDocument: string | undefined,
  queryError: Error | undefined,
  queryResult: string | undefined
) => {
  if (documentError) return "### Can't load JSON document 🙍‍♀️\n\n" + documentError.message;
  if (isLoading) return "### Spinning gears... ⌛";
  if (!jsonDocument) return "### No JSON in clipboard 🤷‍♀️\n\nCopy a JSON document to the clipboard";
  if (queryError) return String(queryError);

  if (queryResult) {
    let result = queryResult
    if (result.length > 5000) {
      result = result.substring(0, 5000) + '\n' +
        "... (rest of the result is truncated for performance reasons.\n" +
        '     Use "Copy To Clipboard" action to get the full result)';
    }
    return "```json\n" + result + "\n```"
  };

  return "Type a query to see the result";
}

export default function Command() {
  const [query, setQuery] = useState(".");

  // Check if jq is available
  const { isLoading: isCheckingJq, data: isJqAvailable } = useCachedPromise(async () => {
    const toast = await showToast({
      title: "Checking jq availability",
      style: Toast.Style.Animated,
    });

    try {
      const version = await ensureJq();
      toast.style = Toast.Style.Success;
      toast.message = version;
      setTimeout(() => toast.hide(), 1000);
      await toast.hide();
      return true;
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.message = String(err);
    }
  }, []);

  // Read the JSON document from the clipboard
  const {
    isLoading: isLoadingDocument,
    data: jsonDocument,
    error: documentError
  } = usePromise(async () => {
    const text = await Clipboard.readText();
    if (text === undefined) {
      return;
    }

    try {
      // Intentionally disable the next line to allow the JSON.parse
      // to throw an error when clipboard is empty
      // TODO: Try to pass to jq without parsing and read the error to determine if the input is valid
      JSON.parse(text); // eslint-disable-line @typescript-eslint/no-unused-expressions
      return text;
    } catch (err) {
      throw new Error("JSON document in in clipboard is invalid");
    }
  }, [], {});

  // Execute the query, when all prerequisites are met
  const {
    isLoading: isRunningQuery,
    data: queryResult,
    error: queryError,
  } = useExec(JQ_EXEC, [query], {
    input: jsonDocument,
    initialData: jsonDocument,
    keepPreviousData: true,
    execute: !!(isJqAvailable && query && jsonDocument),
    failureToastOptions: {
      title: "Query error",
      message: "Check the query syntax and try again.",
    },
  });

  const listActions = useMemo(() => {
    return (
      <ActionPanel title="Actions">
        {queryResult && <Action.CopyToClipboard title="Copy Result" content={queryResult} />}
        <Action.CopyToClipboard title="Copy Query" content={query} />
      </ActionPanel>
    );
  }, [query, queryResult]);

  const isLoading = isCheckingJq || isRunningQuery || isLoadingDocument;

  const detailsContent = getDetailsContent(
    isLoading,
    documentError,
    jsonDocument,
    queryError,
    queryResult
  );

  return (
    <List
      // FIXME: isLoading is not triggered on running the query
      isLoading={isLoading}
      isShowingDetail={true}
      // TODO: Add debounce
      onSearchTextChange={(text) => text !== "" && setQuery(text)}
      actions={listActions}
    >
      <List.Item
        title="Current document"
        detail={<List.Item.Detail markdown={detailsContent} />}
      />
    </List>
  );
}
