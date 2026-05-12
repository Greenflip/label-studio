export const snapConfig = `
<View>
  <Image name="img" value="$image" zoom="true" />
  <PolygonLabels name="poly" toName="img" snap="vertex,edge" snapthreshold="12">
    <Label value="outline" background="red" snapgroup="roof-geom" hotkey="o" />
    <Label value="dormer" background="blue" snapgroup="roof-geom" hotkey="d" />
    <Label value="window" background="green" hotkey="w" />
  </PolygonLabels>
  <VectorLabels name="vec" toName="img" snap="vertex,edge" snapthreshold="12">
    <Label value="inline" background="orange" snapgroup="roof-geom" hotkey="i" />
  </VectorLabels>
</View>
`;

// Solid placeholder so tests don't depend on a third-party CDN.
export const snapImageData = {
  image: "https://placehold.co/1200x600/eeeeee/333333.png?text=Snap+Test",
};
