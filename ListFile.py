import os
import argparse
import json

parser = argparse.ArgumentParser(description='Print files in the directory')
parser.add_argument('directory', type=str, help="directory to search")

args = parser.parse_args()

if os.path.exists(args.directory) and os.path.isdir(args.directory):
    data = []
    for (dirpath, dirnames, filenames) in os.walk(args.directory, topdown=True):
        dirnames = [dirname for dirname in dirnames if dirname[0] != "."]
        filenames = [filename for filename in filenames if filename[0] != "."]
        for dirname in dirnames:
            data.append([os.path.join(dirpath, dirname), dirname, "dir"])
        for filename in filenames:
            data.append([os.path.join(dirpath, filename), filename, "file"])

    with open("dirList.data", "w+") as f:
        f.write(json.dumps(data))
