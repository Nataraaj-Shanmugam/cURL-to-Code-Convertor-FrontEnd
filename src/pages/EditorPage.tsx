import { useLocation, useNavigate } from "react-router-dom";
import ParsedCurlEditor from "@/components/features/curl/ParsedCurlEditor";

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = location.state?.parsed;
  const originalCurl = location.state?.originalCurl;

  const handleBack = () => {
    navigate('/playground');
  };

  return (
    <ParsedCurlEditor 
      initialData={parsed} 
      originalCurl={originalCurl}
      onBack={handleBack}
    />
  );
}