import React, {useState} from "react";
import {GoogleGenAI} from "@google/genai";

const MODEL = 'gemini-3.5-flash'

function App() {
    const [apiKey, setApiKey] = useState();
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState('');
    const [summaryType, setSummaryType] = useState('brief');

    // Initialize the client with your key
    const [ai, setAi] = useState( undefined);

    const setApiKeyToChromeStore = async (apiKey) => {
        if (!apiKey) return;
        // eslint-disable-next-line no-undef
        await chrome.storage.local.set({apiKey});
    };

    const getApiKeyFromChromeStore = async () => {
        // eslint-disable-next-line no-undef
        const {apiKey} = await chrome.storage.local.get('apiKey');
        return apiKey;
    };

    React.useEffect(() => {
        getApiKeyFromChromeStore().then(apiKey => setApiKey(apiKey));
    }, []);

    const getSummaryFromAi = async (pageContent, summaryType, apiKey) => {
        // Truncate very long texts to avoid API limits (typically around 30K tokens)
        const maxLength = 20000;
        const truncatedText =
            pageContent.length > maxLength ? pageContent.substring(0, maxLength) + "..." : pageContent;

        let prompt;
        switch (summaryType) {
            case "brief":
                prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${truncatedText}`;
                break;
            case "detailed":
                prompt = `Provide a detailed summary of the following article, covering all main points and key details:\n\n${truncatedText}`;
                break;
            case "bullets":
                prompt = `Summarize the following article in 5-7 key points. Format each point as a line starting with "- " (dash followed by a space). Do not use asterisks or other bullet symbols, only use the dash. Keep each point concise and focused on a single key insight from the article:\n\n${truncatedText}`;
                break;
            default:
                prompt = `Summarize the following article:\n\n${truncatedText}`;
        }

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }],
                            },
                        ],
                        generationConfig: {
                            temperature: 0.2,
                        },
                    }),
                }
            );

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || "API request failed");
            }

            const data = await res.json();
            return (
                data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                "No summary available."
            );
        } catch (error) {
            console.error("Error calling Gemini API:", error);

            throw new Error("Failed to generate summary. Please try again later.", { cause: error });
        }


    };

    async function handleGenerateSummary() {
        console.log(`generate summary`)
        if(!apiKey) return console.error('No API key found');
        try{

        const pageContent = await getChromeTabsAndGetContent();
        setIsLoading(true)
        const response = await getSummaryFromAi(pageContent,summaryType,apiKey);
        setIsLoading(false)
        setSummary(response);
        } catch (e) {
            console.error(e);
        }
    }

    const getChromeTabsAndGetContent = async () => {
        // eslint-disable-next-line no-undef
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        console.log('Tabs',tab);
        if (!tab.id) return;

        // eslint-disable-next-line no-undef
        const results = await chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
            },
            func: getScrappingText,
        });

        console.log('Results',results)
        return results[0].result;
    };


    const getScrappingText = ()=>{
        const articleText = document.querySelector("article");
        console.log('articleText',articleText);
        if(articleText) return articleText.innerText;

        const divElement = document.querySelectorAll('div');
        console.log('divElement',divElement);
        return Array.from(divElement).map(p => p.innerText).join('\n');

    }

    function handleCopySummary() {
        console.log('copy summary')
    }

    const handleSummaryTypeChange = (e) => {
        setSummaryType(e.target.value);
        // console.log(e.target.value);
    }

    function handleSaveApiKey() {
        const apiKey = document.getElementById('api_key_input').value;
        if (!apiKey) return;

        console.log('API_KEY',  apiKey);

        try {
            const aiObject = new GoogleGenAI({apiKey});
            setIsLoading(true);
            aiObject.models.generateContent({
                model: MODEL,
                contents: 'Say hello',
            }).then(() => {
                setApiKey(apiKey);
                setAi(aiObject);
                console.log('save api key')
            }).finally(()=>{
                setApiKeyToChromeStore(apiKey);
                setIsLoading(false);
            });

        } catch (e) {
            console.log(e);
        }
    }

    return (
        <>
            <div className="w-96 h-96 bg-white rounded-2xl dark:bg-black p-5">
                <h2 className="text-2xl font-bold mb-5 underline underline-offset-2">AI Summary</h2>
                <div className="w-full h-full">
                    {isLoading && (
                        <div className="w-full h-full">
                            <h2 className="text-base font-semibold">Loading...</h2>
                        </div>
                    )}
                    {!apiKey && (
                        <div className="w-full h-full">
                            <h2 className="text-base font-semibold">Add your Gemini API Key</h2>
                            <input type="text" id="api_key_input"
                                   className="border border-gray-300 rounded-md p-2 w-full my-2"
                                   placeholder="Enter your API Key"/>
                            <div className="flex items-center justify-between">
                                <button
                                    className="bg-blue-500 text-white rounded-md p-2 hover:bg-blue-600 cursor-pointer"
                                    onClick={() => handleSaveApiKey()}>Save
                                </button>
                                <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer"
                                   className="text-blue-500 hover:underline">How to get API Key</a>
                            </div>
                        </div>
                    )}
                    {apiKey && !isLoading && (
                        <div className="w-full h-full">
                            <div className="flex items-center justify-between">
                                <select id="summary-type" className="border border-gray-300 rounded-md p-2"
                                        onChange={(e) => handleSummaryTypeChange(e)}>
                                    <option value="brief">Brief</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="bullet_points">Bullet points</option>
                                </select>

                                <div className="flex items-center gap-2">
                                    <button
                                        className="bg-blue-500 text-white rounded-md p-2 hover:bg-blue-600 cursor-pointer"
                                        onClick={() => handleGenerateSummary()}>Generate
                                        Summary
                                    </button>
                                    <button
                                        className="bg-green-500 text-white rounded-md p-2 hover:bg-green-600 cursor-pointer"
                                        onClick={handleCopySummary}>Copy
                                    </button>
                                </div>
                            </div>
                            <pre id="summary_result"
                                 className="w-full min-h-20 h-max mt-5 border boder-gray-300 rounded-md p-2 overflow-y-scroll text-wrap">{summary?summary:'Select Summary Type and click Generate Summary....'}</pre>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default App
