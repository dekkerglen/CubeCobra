import json
import os
import sys

import anthropic

ROOT_DIRECTORY = os.path.normpath(os.path.join(os.path.dirname(sys.argv[0]), "..", "src"))

# Set up the Anthropic client
with open(os.path.join(os.path.dirname(sys.argv[0]), "convert_tsx.json"), "r") as f:
    client = anthropic.Anthropic(api_key=json.load(f)["anthropic_api_key"])

def list_files(startpath):
    lines = []
    for root, dirs, files in os.walk(startpath):
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * (level)
        lines.append('{}{}/'.format(indent, os.path.basename(root)))
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            lines.append('{}{}'.format(subindent, f))
    return "\n".join(lines)

def ts_file_contents(directory, exclude):
    results = []
    for filename in os.listdir(directory):
        if filename.endswith(".ts") or filename.endswith(".tsx"):
            path = os.path.join(directory, filename)
            if path == exclude: continue
            with open(path, "r") as f:
                results.append(f"{path}:\n```typescript\n{f.read()}```")
    return "\n\n".join(results)

def convert_to_typescript(ts_path, file_content):
    human_prompt = f"""
Convert the following JavaScript file to TypeScript.
You can convert PropTypes into native TypeScript interfaces. If the original file exports (e.g.) XyzPropType, the output should no longer export XyzPropType and should instead export default an interface called Xyz.
Transform any import {{ Xyz }} from 'proptypes/XyzPropType' into import Xyz from 'datatypes/Xyz'.
Otherwise, don't change any of the code, other than adding type annotations.
It should pass a standard linter test afterwards.
Assume all of the imported files are undergoing the same transformation and will export types if needed.
For React contexts, assume that the module for a context named (e.g.) XContext will export an interface named XContextValue for the context's value. Except CubeContext, whose value has type CubeWithCards.
Every function, including short arrow functions, should have your best guess at type annotations for its arguments and return value. Try to make an educated guess based on the project structure rather than using "any."
Especially try to figure out the right type for event handler callbacks in JSX code.
Please print all of the output code; don't omit any of the converted code.
Absolutely DO NOT put a comment saying that the rest of the code remains the same. It's really important. I need to see all the code.
Even if the code is repetitive or boring, just write it all down for me. Please.

For context, here are all the files in the project:
{list_files(ROOT_DIRECTORY)}

For context, here are some files you have already translated:
{ts_file_contents(os.path.join(ROOT_DIRECTORY, "datatypes"), ts_path)}

Please provide only the TypeScript code without any additional comments or explanations.

{file_content}
    """

    keep_going_prompt = "Can you please keep going, starting at the exact location where you left off? Don't reprint any code you printed in your previous response, includig not reprinting any of the last line of the previous response. You should be able to concatenate your previous response and this one and get the correct, valid TypeScript code."

    assistant_prompt = """
Certainly! I'll convert the JavaScript code to TypeScript by adding type annotations without changing the existing code.
Here's the TypeScript version:
```typescript"""

    assistant_keep_going_prompt = """
Certainly! I'll pick up where I left off.
```"""

    message = None
    i = 0
    raw_result = ""
    result = ""
    while i < 5 and (message is None or message.stop_reason == "max_tokens"):
        i += 1
        turns = [
                {
                    "role": "user",
                    "content": human_prompt,
                },
                {
                    "role": "assistant",
                    "content": assistant_prompt + raw_result,
                }
            ]

        message = client.messages.create(
            model="claude-3-haiku-20240307",
            system="You are an expert JavaScript and TypeScript developer. Your task is to convert JavaScript code to TypeScript.",
            messages=turns,
            max_tokens=4096,
            temperature=0,
            stop_sequences=["```"],
            # extra_headers={
            #     "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
            # },
        )

        # print(f"started with [{message.content[0].text.strip().splitlines()[0]}]")
        # print(f"ended with [{message.content[0].text.strip().splitlines()[-1]}]")

        raw_result += message.content[0].text.strip()
        # result += "\n\nBREAK\n\n" + message.content[0].text.strip()
    
    return raw_result + "\n"

def process_file(directory, filename, force=False):
    file_path = os.path.join(directory, filename)

    ts_filename = filename[:-3] + '.tsx'
    ts_path = os.path.join(directory, ts_filename)
    if not force and os.path.exists(ts_path): return

    # Read the JavaScript file
    with open(file_path, 'r') as file:
        js_content = file.read()

    # Convert to TypeScript
    ts_content = convert_to_typescript(ts_path, js_content)

    # Save as TypeScript file
    with open(ts_path, 'w') as file:
        file.write(ts_content)

    print(f"Converted {filename} to {ts_filename}")

def process_directory(directory):
    for filename in sorted(os.listdir(directory)):
        if filename.endswith('.js'):
            process_file(directory, filename)

if __name__ == "__main__":
    if os.path.isdir(sys.argv[1]):
        process_directory(sys.argv[1])
    else:
        process_file(os.path.dirname(sys.argv[1]), os.path.basename(sys.argv[1]), force=True)