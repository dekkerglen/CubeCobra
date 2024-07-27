import anthropic
import json
import os
import sys

# Set up the Anthropic client
with open(os.path.join(os.path.dirname(sys.argv[0]), "convert_tsx.json"), "r") as f:
    client = anthropic.Anthropic(api_key=json.read(f)["anthropic_api_key"])

def convert_to_typescript(file_content):
    human_prompt = f"""
Convert the following JavaScript file to TypeScript.
You can convert PropTypes into native TypeScript interfaces. If the original file exports (e.g.) XyzPropType, the output should no longer export XyzPropType and should instead export default an interface called Xyz.
Transform any import {{ Xyz }} from 'proptypes/XyzPropType' into import Xyz from 'datatypes/Xyz'.
Otherwise, don't change any of the code, other than adding type annotations.
It should pass a standard linter test afterwards.
Assume all of the imported files are undergoing the same transformation and will export types if needed.
For React contexts, assume that the module for a context named (e.g.) XContext will export an interface named XContextValue for the context's value.
Please provide only the TypeScript code without any additional comments or explanations.

{file_content}
    """

    assistant_prompt = """
Certainly! I'll convert the JavaScript code to TypeScript by adding type annotations without changing the existing code.
Here's the TypeScript version:
```typescript"""

    message = client.messages.create(
        model="claude-3-haiku-20240307",
        system="You are an expert JavaScript and TypeScript developer. Your task is to convert JavaScript code to TypeScript.",
        messages=[
            {
                "role": "user",
                "content": human_prompt,
            },
            {
                "role": "assistant",
                "content": assistant_prompt
            }
        ],
        max_tokens=4096,
        temperature=0,
        stop_sequences=["```"],
        # extra_headers={
        #     "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
        # },
    )

    return message.content[0].text.strip() + "\n"

def process_file(directory, filename, force=False):
    file_path = os.path.join(directory, filename)

    ts_filename = filename[:-3] + '.tsx'
    ts_path = os.path.join(directory, ts_filename)
    if not force and os.path.exists(ts_path): return

    # Read the JavaScript file
    with open(file_path, 'r') as file:
        js_content = file.read()

    # Convert to TypeScript
    ts_content = convert_to_typescript(js_content)

    # Save as TypeScript file
    with open(ts_path, 'w') as file:
        file.write(ts_content)

    print(f"Converted {filename} to {ts_filename}")

def process_directory(directory):
    for filename in os.listdir(directory):
        if filename.endswith('.js'):
            process_file(directory, filename)

if __name__ == "__main__":
    if os.path.isdir(sys.argv[1]):
        process_directory(sys.argv[1])
    else:
        process_file(os.path.dirname(sys.argv[1]), os.path.basename(sys.argv[1]), force=True)