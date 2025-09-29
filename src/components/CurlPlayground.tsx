import { useState } from "react";
import { parseCurl, generateCode, executeRequest, ParsedRequest } from "../services/api";

export default function CurlPlayground() {
  const [curl, setCurl] = useState("");
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [execution, setExecution] = useState<any>(null);

  const handleParse = async () => {
    const result = await parseCurl(curl);
    setParsed(result.parsed || null);
  };

  const handleGenerate = async (language: string) => {
    if (!parsed) return;
    const result = await generateCode(parsed, language);
    setCode(result.code);
  };

  const handleExecute = async () => {
    if (!parsed) return;
    const result = await executeRequest(parsed);
    setExecution(result);
  };

  return (
    <div>
      <textarea value={curl} onChange={(e) => setCurl(e.target.value)} />
      <button onClick={handleParse}>Parse</button>
      {parsed && (
        <>
          <pre>{JSON.stringify(parsed, null, 2)}</pre>
          <button onClick={() => handleGenerate("python")}>Generate Code</button>
          {code && <pre>{code}</pre>}
          <button onClick={handleExecute}>Execute</button>
          {execution && <pre>{JSON.stringify(execution, null, 2)}</pre>}
        </>
      )}
    </div>
  );
}
