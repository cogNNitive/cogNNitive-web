{
  function makeNode(type, data) {
    return { type, ...data };
  }
}

Start
  = BOM? body:Block* { return { type: "Script", body: body.filter(b => b !== null) }; }

BOM = "\uFEFF"

Block
  = Section
  / VusHeader
  / Layer
  / Set
  / Scene
  / GlobalProperty
  / Comment
  / Content
  / TopLevelAssetShortcut
  / Whitespace { return null; }
  / BlankLine { return null; }

Node
  = Section
  / VusHeader 
  / Layer 
  / Set
  / Scene 
  / GlobalProperty 
  / Comment 
  / Content
  / TopLevelAssetShortcut

VusHeader
  = _ "//" _ "ANYDEO_SPEC:" _ version:Value {
      return makeNode("GlobalProperty", { key: "video_anydeo_specification", value: version });
    }

Layer
  = _ "@@" index:([0-9]+)? _ name:Name EOL props:PropertyBlock? {
      return makeNode("Layer", { 
        name, 
        marker: "@@",
        index: index ? parseInt(index.join("")) : undefined,
        properties: props || {}
      });
    }

Section
  = _ marker:("###" / "##" / "#") _ name:Name EOL props:PropertyBlock? {
      return makeNode("Section", { name, marker, properties: props || {} });
    }

Set
  = _ "@set" _ name:Key _ description:SimpleValue? EOL props:PropertyBlock? {
      return makeNode("Set", { name, description: description || "", properties: props || {} });
    }

Scene
  = _ "@" ws:$(_ ) name:Name EOL props:PropertyBlock?
    {
      const properties = props || {};
      const lowName = name.toLowerCase();
      const parts = name.split(/[ \t]+/);
      
      // Template definitions: @template name, @layer name, @video name
      const isTemplateDef = lowName.startsWith("template ") || 
                            lowName.startsWith("layer ") || 
                            lowName.startsWith("video ");

      if (isTemplateDef) {
        properties.block_type = "template";
        return {
          type: "Scene",
          name: parts.slice(1).join(" ") || parts[0],
          marker: "@",
          properties: properties,
          scene_templates: [],
          loc: location()
        };
      }

      // If no space after @ (e.g. @with_text), it's a scene using a template
      if (ws.length === 0) {
        const templates = [];
        let i = 0;
        templates.push(parts[0]);
        i++;
        while (i < parts.length && parts[i].startsWith('@')) {
            templates.push(parts[i].substring(1));
            i++;
        }
        
        const finalName = parts.slice(i).join(" ") || templates.join(" ");

        return {
          type: "Scene",
          name: finalName,
          marker: "@",
          properties: properties,
          scene_templates: templates,
          loc: location()
        };
      }

      return {
        type: "Scene",
        name: name,
        marker: "@",
        properties: properties,
        scene_templates: [],
        loc: location()
      };
    }


GlobalProperty
  = _ "-" " "+ key:Key ":" _ value:Value {
      return makeNode("GlobalProperty", { key, value });
    }


PropertyBlock
  = items:PropertyItem+ {
      return items.reduce((acc, node) => {
        if (node && node.type === "Property") {
          acc[node.key] = node.value;
        }
        return acc;
      }, {});
    }

PropertyItem
  = _ !BlockMarker node:(Property / Comment) _ EOL {
      return node;
    }
  / BlankLine { return null; }

Property
  = _ "-" " "+ key:Key ":" _ value:Value {
      return makeNode("Property", { key, value });
    }

  / AssetShortcut

AssetShortcut
  = _ "![" label:$([^\]\n\r]*) "]" "(" path:$([^\)\n\r]*) ")" {
      return makeNode("Property", { key: "layer_asset_source", value: path.trim() });
    }

TopLevelAssetShortcut
  = _ "![" label:$([^\]\n\r]*) "]" "(" path:$([^\)\n\r]*) ")" {
      return makeNode("GlobalProperty", { key: "layer_asset_source", value: path.trim() });
    }

Comment 
  = _ "###" content:[^\n]* { return makeNode("Comment", { content: content.join("") }); }
  / _ "//" content:[^\n]* { return makeNode("Comment", { content: content.join("") }); }
  / _ "#" !(" " / "#") content:[^\n]* { return makeNode("Comment", { content: content.join("") }); }
  / _ "#" content:[^\n]* { return makeNode("Comment", { content: content.join("") }); }

Content
  = (!MarkerLine [^\n\r]+ EOL)+ { 
      const textStr = text().trim();
      if (textStr.length === 0) return null;
      return makeNode("Content", { text: textStr }); 
    }

BlockMarker = "@set" / "@" / "§" / "@@" / "##" / "###" / "#"
MarkerLine 
  = _ BlockMarker 
  / _ "-"
  / _ "//"

  / _ "!["

GlobalKey = $([a-zA-Z0-9_().\-/]+)


Value
  = MultilineValue / SimpleValue

MultilineValue
  = "```" _ NewLine? content:$( (!"```" ( . / NewLine ))* ) "```" {
      return content.replace(/^[\r\n]+|[\r\n\s]+$/g, "");
    }

SimpleValue
  = $[^\n\r]* { return text().trim(); }

Key = $([a-zA-Z0-9_().\-/]+)
Name = $[^\n\r]* { return text().trim(); }

Whitespace = [ \t]+
BlankLine = _ NewLine { return null; }
NewLine = "\r\n" / "\n" / "\r"
EOL = NewLine / EOF
_ = [ \t]*
EOF = !.
